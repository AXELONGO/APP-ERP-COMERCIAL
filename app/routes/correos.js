const asyncHandler = require('../middleware/asyncHandler');
const { getSheets, getPublicData, getSheetId, SPREADSHEET_ID } = require('../config/sheets');
const { getGmail, getGmailAuthUrl, saveGmailTokenFromCode, hasGmailToken } = require('../config/gmail');

const SHEET_NAME = 'Campañas';
const HEADERS = ['campaign_id', 'subject', 'html_body', 'text_body', 'recipients', 'status', 'send_stats', 'created_at', 'updated_at'];
const MAX_RECIPIENTS = Number(process.env.GMAIL_MAX_RECIPIENTS_PER_CAMPAIGN || 500);
const DAILY_RECIPIENT_LIMIT = Number(process.env.GMAIL_DAILY_RECIPIENT_LIMIT || 500);
const SEND_DELAY_MS = Number(process.env.GMAIL_SEND_DELAY_MS || 100);
const FROM_ADDRESS = process.env.GMAIL_FROM_ADDRESS || 'demiansoberanes7@gmail.com';
const FROM_NAME = process.env.GMAIL_FROM_NAME || 'ERP LUMARK';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function ensureCampaignSheet(sheets) {
  let sheetId = await getSheetId(sheets, SHEET_NAME);
  if (!sheetId) {
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }
    });
    sheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A1:I1`,
    valueInputOption: 'RAW',
    resource: { values: [HEADERS] }
  });
  return sheetId;
}

async function appendCampaign(sheets, campaign) {
  await ensureCampaignSheet(sheets);
  const row = HEADERS.map(header => campaign[header] ?? '');
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A:I`,
    valueInputOption: 'RAW',
    resource: { values: [row] }
  });
}

async function updateCampaign(sheets, campaignId, campaign) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${SHEET_NAME}'!A:A` });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === campaignId) + 1;
  if (rowIndex < 1) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A${rowIndex}:I${rowIndex}`,
    valueInputOption: 'RAW',
    resource: { values: [HEADERS.map(header => campaign[header] ?? '')] }
  });
}

function encodeMessage({ to, from, subject, htmlBody, textBody }) {
  const boundary = `=_ERP_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines = [
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    `From: ${FROM_NAME} <${from}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    textBody || '',
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlBody || '',
    '',
    `--${boundary}--`
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

function normalizeRecipients(recipients) {
  const seen = new Set();
  return (Array.isArray(recipients) ? recipients : []).map(item => ({
    name: String(item.name || '').trim(),
    email: String(item.email || '').trim().toLowerCase(),
    prospect_id: String(item.prospect_id || '').trim()
  })).filter(item => {
    if (!/^\S+@\S+\.\S+$/.test(item.email) || seen.has(item.email)) return false;
    seen.add(item.email);
    return true;
  });
}

function registerCorreosRoutes(app) {
  app.get('/api/auth/gmail', (req, res) => res.redirect(getGmailAuthUrl()));

  app.get('/api/auth/gmail/callback', asyncHandler(async (req, res) => {
    if (!req.query.code) return res.status(400).send('Código OAuth faltante');
    await saveGmailTokenFromCode(req.query.code);
    res.redirect('/?gmail=connected');
  }));

  app.get('/api/correos/auth/status', (req, res) => {
    let configured = false;
    try { getGmailAuthUrl(); configured = true; } catch (_) {}
    res.json({ configured, authorized: hasGmailToken(), scope: 'https://www.googleapis.com/auth/gmail.send', authUrl: configured ? '/api/auth/gmail' : null, reconnect_required: configured && !hasGmailToken() });
  });

  app.get('/api/correos/campanas', asyncHandler(async (req, res) => {
    try { res.json((await getPublicData(SHEET_NAME)).filter(item => item.campaign_id)); } catch (_) { res.json([]); }
  }));

  app.get('/api/correos/prospectos', asyncHandler(async (req, res) => {
    const prospects = await getPublicData('Prospectos');
    const seen = new Set();
    const recipients = prospects.map(prospect => {
      const prospectId = String(prospect['ID Prospectos'] || '').trim();
      const email = String(prospect['Correo Electrónico'] || '').trim().toLowerCase();
      return {
        prospect_id: prospectId,
        name: String(prospect['Nombre del Contacto'] || '').trim(),
        email,
        segment: prospect['Etapa'] || prospect['Medio de contacto'] || prospect['Situacion'] || ''
      };
    }).filter(item => {
      if (!item.prospect_id || !/^\S+@\S+\.\S+$/.test(item.email) || seen.has(item.email)) return false;
      seen.add(item.email);
      return true;
    });
    res.json(recipients);
  }));

  app.post('/api/correos/draft', asyncHandler(async (req, res) => {
    const recipients = normalizeRecipients(req.body.recipients);
    if (!String(req.body.subject || '').trim()) return res.status(400).json({ error: 'El asunto es obligatorio' });
    const now = new Date().toISOString();
    const campaign = {
      campaign_id: `CMP-${Date.now().toString(36).toUpperCase()}`,
      subject: String(req.body.subject).trim(),
      html_body: String(req.body.html_body || ''),
      text_body: String(req.body.text_body || ''),
      recipients: JSON.stringify(recipients),
      status: 'borrador',
      send_stats: JSON.stringify({ total: recipients.length, sent: 0, failed: 0, errors: [] }),
      created_at: now,
      updated_at: now
    };
    await appendCampaign(await getSheets(), campaign);
    res.json({ success: true, campaign_id: campaign.campaign_id, status: campaign.status });
  }));

  app.post('/api/correos/send', asyncHandler(async (req, res) => {
    const subject = String(req.body.subject || '').trim();
    const htmlBody = String(req.body.html_body || '');
    const textBody = String(req.body.text_body || '').trim();
    const recipients = normalizeRecipients(req.body.recipients);
    if (!subject || (!htmlBody && !textBody) || !recipients.length) return res.status(400).json({ error: 'Asunto, cuerpo y destinatarios válidos son obligatorios' });
    if (recipients.length > MAX_RECIPIENTS) return res.status(400).json({ error: `La campaña supera el límite configurado de ${MAX_RECIPIENTS} destinatarios` });

    const now = new Date().toISOString();
    const history = (await getPublicData(SHEET_NAME).catch(() => [])).filter(item => item.campaign_id);
    const today = now.slice(0, 10);
    const sentToday = history.reduce((sum, item) => {
      if (!String(item.created_at || '').startsWith(today)) return sum;
      try { return sum + (JSON.parse(item.send_stats || '{}').sent || 0); } catch (_) { return sum; }
    }, 0);
    if (sentToday + recipients.length > DAILY_RECIPIENT_LIMIT) return res.status(429).json({ error: `Se alcanzaría el límite diario configurado de ${DAILY_RECIPIENT_LIMIT} destinatarios`, sent_today: sentToday });
    const campaignId = `CMP-${Date.now().toString(36).toUpperCase()}`;
    const sheets = await getSheets();
    const campaign = { campaign_id: campaignId, subject, html_body: htmlBody, text_body: textBody, recipients: JSON.stringify(recipients), status: 'enviando', send_stats: JSON.stringify({ total: recipients.length, sent: 0, failed: 0, errors: [] }), created_at: now, updated_at: now };
    await appendCampaign(sheets, campaign);

    const stats = { total: recipients.length, sent: 0, failed: 0, errors: [] };
    let gmail;
    try {
      gmail = await getGmail();
    } catch (error) {
      stats.failed = recipients.length;
      stats.errors.push({ email: null, message: error.message });
      campaign.status = 'error';
      campaign.send_stats = JSON.stringify(stats);
      campaign.updated_at = new Date().toISOString();
      await updateCampaign(sheets, campaignId, campaign);
      return res.status(503).json({ success: false, campaign_id: campaignId, status: campaign.status, send_stats: stats, error: error.message, reconnect_required: error.message === 'GMAIL_NO_TOKEN' || error.message === 'GMAIL_SCOPE_REQUIRED', auth_url: '/api/auth/gmail' });
    }
    for (let index = 0; index < recipients.length; index += 1) {
      const recipient = recipients[index];
      try {
        await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodeMessage({ to: recipient.email, from: FROM_ADDRESS, subject, htmlBody, textBody }) } });
        stats.sent += 1;
      } catch (error) {
        stats.failed += 1;
        if (stats.errors.length < 25) stats.errors.push({ email: recipient.email, message: error.message });
        if (/quota|rate|limit|daily/i.test(error.message)) {
          stats.failed += recipients.length - index - 1;
          break;
        }
      }
      if (SEND_DELAY_MS > 0) await sleep(SEND_DELAY_MS);
    }
    campaign.status = stats.failed ? (stats.sent ? 'error' : 'error') : 'enviada';
    campaign.send_stats = JSON.stringify(stats);
    campaign.updated_at = new Date().toISOString();
    await updateCampaign(sheets, campaignId, campaign);
    res.json({ success: stats.failed === 0, campaign_id: campaignId, status: campaign.status, sender: FROM_ADDRESS, delivery_status: 'accepted_by_gmail', send_stats: stats });
  }));
}

module.exports = { registerCorreosRoutes };
