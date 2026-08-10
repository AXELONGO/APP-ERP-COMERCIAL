const { query, getPool } = require('../config/database');
const { requireV2Auth, requireRole } = require('../middleware/v2Auth');
const {
  getWahaConfig,
  getSession,
  getChats,
  getChatMessages,
  getAllMessages,
  getLidPhone,
  getContact,
  getLids,
  getContacts,
  configureAndStartSession,
  stopSession,
  getQr,
  sendText,
  sendFile,
} = require('../services/wahaClient');
const { getIntegrationConfig } = require('../services/integrationConfig');

function phoneFromChatId(chatId) {
  const value = String(chatId || '').trim();
  if (!value) return null;
  if (value.endsWith('@s.whatsapp.net')) return `+${value.slice(0, -15).replace(/\D/g, '')}`;
  if (value.endsWith('@c.us')) {
    const digits = value.slice(0, -5).replace(/\D/g, '');
    return digits ? `+${digits}` : null;
  }
  if (value.endsWith('@g.us') || value.endsWith('@lid') || value.endsWith('@newsletter')) return value;
  return null;
}

function chatIdFromPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `${digits}@c.us` : null;
}

function outboundChatId(providerConversationId, phone) {
  const providerId = String(providerConversationId || '').trim();
  if (providerId && !providerId.endsWith('@lid')) return providerId;
  return chatIdFromPhone(phone);
}

function webhookSecretMatches(req) {
  const expected = process.env.WAHA_WEBHOOK_SECRET || '';
  return !expected || req.get('x-erp-webhook-secret') === expected;
}

async function workspaceWahaConfig(workspaceId) {
  const saved = await getIntegrationConfig(workspaceId, 'waha');
  return { ...getWahaConfig(), ...(saved.config || {}) };
}

async function ensureConversation(client, workspaceId, chatId, displayName, displayPhone = null) {
  const phone = displayPhone || phoneFromChatId(chatId);
  if (!phone) return null;
  const contactResult = await client.query(
      `INSERT INTO contacts (workspace_id, name, phone_e164, source)
      VALUES ($1,$2,$3,'whatsapp')
      ON CONFLICT (workspace_id, phone_e164) DO UPDATE SET
       name = CASE WHEN contacts.name IN (contacts.phone_e164, $4) THEN EXCLUDED.name ELSE contacts.name END,
       updated_at = now()
       RETURNING id, name, phone_e164`,
    [workspaceId, displayName || phone, phone, chatId]
  );
  const contact = contactResult.rows[0];
  const conversationResult = await client.query(
    `INSERT INTO conversations (workspace_id, contact_id, channel, provider_conversation_id)
     VALUES ($1,$2,'whatsapp',$3)
     ON CONFLICT DO NOTHING
     RETURNING id, contact_id, channel, provider_conversation_id`,
    [workspaceId, contact.id, chatId]
  );
  if (conversationResult.rows[0]) return conversationResult.rows[0];
  const existing = await client.query(
    `SELECT id, contact_id, channel, provider_conversation_id
     FROM conversations WHERE workspace_id = $1 AND provider_conversation_id = $2 LIMIT 1`,
    [workspaceId, chatId]
  );
  if (!existing.rows[0]) return null;
  if (existing.rows[0].contact_id !== contact.id) {
    await client.query('UPDATE conversations SET contact_id=$1, updated_at=now() WHERE id=$2 AND workspace_id=$3', [contact.id, existing.rows[0].id, workspaceId]);
    existing.rows[0].contact_id = contact.id;
  }
  return existing.rows[0];
}

async function persistWahaMessage(event) {
  const payload = event?.payload || {};
  const chatId = payload.fromMe && payload.to && payload.to !== 'me' ? payload.to : payload.from;
  const conversationId = chatId && event.workspaceId
    ? await persistMessageForWorkspace(event.workspaceId, chatId, payload, event.chatName, event.chatPhone)
    : null;
  return conversationId;
}

async function resolveWebhookContact(config, chatId) {
  if (!String(chatId || '').endsWith('@lid')) return {};
  const lid = await getLidPhone(config.session, chatId, config).catch(() => null);
  const contact = await getContact(config.session, chatId, config).catch(() => null);
  const rawPhone = lid?.pn || lid?.phone || contact?.number || contact?.id || '';
  const phoneId = String(rawPhone).includes('@') ? rawPhone : `${rawPhone}@c.us`;
  const phone = phoneFromChatId(phoneId);
  return { phone, name: contact?.name || contact?.pushname || contact?.shortName || null };
}

function messageTimestamp(payload) {
  const value = Number(payload?.timestamp);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value > 100000000000 ? value / 1000 : value;
}

async function persistMessageForWorkspace(workspaceId, chatId, payload, chatName = null, chatPhone = null) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const name = chatName || payload._data?.notifyName || payload._data?.pushName || payload.pushName || chatPhone || phoneFromChatId(chatId);
    const conversation = await ensureConversation(client, workspaceId, chatId, name, chatPhone);
    if (!conversation) { await client.query('ROLLBACK'); return null; }
    const body = payload.body || (payload.hasMedia ? `[${payload.media?.mimetype || 'media'}]` : '[mensaje sin texto]');
    const inserted = await client.query(
      `INSERT INTO messages (workspace_id, conversation_id, direction, channel, body, provider_message_id, delivery_status, created_at)
       VALUES ($1,$2,$3,'whatsapp',$4,$5,$6,COALESCE(to_timestamp($7), now()))
       ON CONFLICT (workspace_id, provider_message_id) WHERE provider_message_id IS NOT NULL
       DO UPDATE SET created_at = EXCLUDED.created_at, delivery_status = EXCLUDED.delivery_status
       RETURNING id, (xmax = 0) AS inserted`,
      [workspaceId, conversation.id, payload.fromMe ? 'outbound' : 'inbound', body, payload.id || null, payload.fromMe ? 'sent' : 'received', messageTimestamp(payload)]
    );
    await client.query(
      `UPDATE conversations SET last_activity_at = now(), updated_at = now(),
       status = CASE WHEN $2 = 'inbound' THEN 'open' ELSE status END
       WHERE id = $1 AND workspace_id = $3`,
      [conversation.id, payload.fromMe ? 'outbound' : 'inbound', workspaceId]
    );
    if (inserted.rows[0]?.inserted) {
      await client.query(
        `INSERT INTO audit_events (workspace_id,event_type,entity_type,entity_id,actor_type,after_data)
         VALUES ($1,'message.received','conversation',$2,'integration',$3)`,
        [workspaceId, conversation.id, JSON.stringify({ provider: 'waha', message_id: payload.id || null })]
      );
    }
    await client.query('COMMIT');
    return conversation.id;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function normalizeWahaConversationTimes(workspaceId) {
  await query(
    `UPDATE conversations c
     SET last_activity_at = latest.created_at,
         updated_at = GREATEST(c.updated_at, latest.created_at)
     FROM (
       SELECT conversation_id, MAX(created_at) AS created_at
       FROM messages
       WHERE workspace_id = $1 AND channel = 'whatsapp'
       GROUP BY conversation_id
     ) latest
     WHERE c.id = latest.conversation_id AND c.workspace_id = $1`,
    [workspaceId]
  );
}

async function persistWahaAck(workspaceId, payload) {
  const ack = Number(payload?.ack);
  const deliveryStatus = ack >= 3 ? 'read' : ack === 2 ? 'delivered' : ack >= 1 ? 'sent' : null;
  if (!payload?.id || !deliveryStatus) return;
  await query(
    `UPDATE messages SET delivery_status = $1
     WHERE workspace_id = $2 AND provider_message_id = $3`,
    [deliveryStatus, workspaceId, payload.id]
  );
}

async function resolveWebhookWorkspace(event, req) {
  const suppliedSecret = req.get('x-erp-webhook-secret') || '';
  if (!suppliedSecret) return null;
  if (process.env.WAHA_WEBHOOK_SECRET && suppliedSecret === process.env.WAHA_WEBHOOK_SECRET && process.env.WAHA_WORKSPACE_ID) return process.env.WAHA_WORKSPACE_ID;
  const rows = await query("SELECT workspace_id FROM integration_configs WHERE provider = 'waha' AND enabled = true");
  for (const row of rows.rows) {
    const saved = await getIntegrationConfig(row.workspace_id, 'waha');
    if (saved.config.webhookSecret && saved.config.webhookSecret === suppliedSecret) return row.workspace_id;
    if (saved.config.webhookSecret && saved.config.webhookSecret === suppliedSecret && (!event.session || saved.config.session === event.session)) return row.workspace_id;
  }
  return null;
}

async function syncWahaHistory(workspaceId, config) {
  const identities = await loadWahaIdentities(config);
  const rows = [];
  let offset = 0;
  while (true) {
    const page = await getChats(config.session, config, { limit: 100, offset });
    const items = Array.isArray(page) ? page : [];
    rows.push(...items);
    if (items.length < 100) break;
    offset += items.length;
  }
  let imported = 0;
  for (const chat of rows) {
    const chatId = chat.id || chat.chatId;
    if (!chatId || chatId === 'status@broadcast') continue;
    let chatPhone = null;
    let contact = null;
    if (String(chatId).endsWith('@lid')) {
      chatPhone = phoneFromChatId(identities.get(chatId)?.phone || '');
      contact = await getContact(config.session, chatId, config).catch(() => null);
    }
    chatPhone = chatPhone || phoneFromChatId(contact?.number ? `${contact.number}@c.us` : contact?.id || '');
    const chatName = chat.name || chat._chat?.name || chat._chat?.formattedName || chat._chat?.notifyName || contact?.name || contact?.pushname || contact?.shortName || identities.get(chatId)?.name || chatPhone || phoneFromChatId(chatId);
    const messages = await getChatMessages(config.session, chatId, config, { limit: 100 });
    for (const payload of Array.isArray(messages) ? messages : []) {
      const conversationId = await persistWahaMessage({ event: 'message', session: config.session, workspaceId, payload, chatName, chatPhone });
      if (conversationId) imported += 1;
    }
  }
  await normalizeWahaConversationTimes(workspaceId);
  return { chats: rows.length, messages: imported };
}

async function syncWahaRecent(workspaceId, config) {
  const identities = await loadWahaIdentities(config);
  let rows = await getAllMessages(config.session, config, { limit: 1000, offset: 0 }).catch(() => []);
  if (!Array.isArray(rows) || !rows.length) {
    const chats = await getChats(config.session, config, { limit: 50, offset: 0 });
    rows = [];
    for (const chat of Array.isArray(chats) ? chats : []) {
      const chatId = chat.id || chat.chatId;
      if (!chatId) continue;
      const messages = await getChatMessages(config.session, chatId, config, { limit: 50, offset: 0 }).catch(() => []);
      rows.push(...(Array.isArray(messages) ? messages : []));
    }
  }
  const chatIds = new Set();
  const contactCache = new Map();
  let imported = 0;
  for (const payload of rows) {
    const chatId = payload.fromMe && payload.to && payload.to !== 'me' ? payload.to : payload.from;
    if (!chatId || chatId === 'status@broadcast') continue;
    chatIds.add(chatId);
    if (String(chatId).endsWith('@lid') && !contactCache.has(chatId)) contactCache.set(chatId, await getContact(config.session, chatId, config).catch(() => null));
    const contact = contactCache.get(chatId) || null;
    const identity = identities.get(chatId) || {};
    const mappedPhone = identity.phone || (contact?.number ? `${contact.number}@c.us` : contact?.id || chatId);
    const chatPhone = phoneFromChatId(mappedPhone);
    const chatName = contact?.name || contact?.pushname || contact?.shortName || identity.name || chatPhone;
    if (await persistWahaMessage({ event: 'message', session: config.session, workspaceId, payload, chatName, chatPhone })) imported += 1;
  }
  await normalizeWahaConversationTimes(workspaceId);
  return { chats: chatIds.size, messages: imported };
}

async function loadWahaIdentities(config) {
  const identities = new Map();
  let offset = 0;
  while (true) {
    const page = await getLids(config.session, config, { limit: 100, offset }).catch(() => []);
    const items = Array.isArray(page) ? page : [];
    items.forEach(item => { if (item.lid && item.pn) identities.set(item.lid, { phone: item.pn }); });
    if (items.length < 100) break;
    offset += items.length;
  }
  offset = 0;
  while (true) {
    const page = await getContacts(config.session, config, { limit: 100, offset }).catch(() => []);
    const items = Array.isArray(page) ? page : [];
    items.forEach(item => {
      if (item.id) identities.set(item.id, { phone: item.number ? `${item.number}@c.us` : item.id, name: item.name || item.pushname || item.shortName || '' });
    });
    if (items.length < 100) break;
    offset += items.length;
  }
  return identities;
}

function registerWahaRoutes(app) {
  app.get('/api/v2/waha/status', requireV2Auth, async (req, res, next) => {
    try {
      const config = await workspaceWahaConfig(req.workspaceId);
      if (!config.baseUrl) return res.json({ configured: false, session: config.session });
      const session = await getSession(config.session, config);
      res.json({ configured: true, session });
    } catch (error) { next(error); }
  });

  app.post('/api/v2/waha/session/start', requireV2Auth, requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
      const config = await workspaceWahaConfig(req.workspaceId);
      const webhookUrl = config.webhookUrl || process.env.WAHA_WEBHOOK_URL || (process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/v2/waha/webhook` : '');
      if (!webhookUrl) return res.status(503).json({ error: 'Configura WAHA_WEBHOOK_URL o PUBLIC_BASE_URL antes de iniciar la sesión' });
      const session = await configureAndStartSession({ webhookUrl, webhookSecret: config.webhookSecret || process.env.WAHA_WEBHOOK_SECRET, wahaConfig: config });
      res.json({ data: session });
    } catch (error) { next(error); }
  });

  app.post('/api/v2/waha/sync', requireV2Auth, requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
      const config = await workspaceWahaConfig(req.workspaceId);
      const result = await syncWahaHistory(req.workspaceId, config);
      res.json({ ok: true, ...result });
    } catch (error) { next(error); }
  });

  app.post('/api/v2/waha/sync-recent', requireV2Auth, requireRole('admin', 'supervisor', 'advisor'), async (req, res, next) => {
    try {
      const config = await workspaceWahaConfig(req.workspaceId);
      const result = await syncWahaRecent(req.workspaceId, config);
      res.json({ ok: true, ...result });
    } catch (error) { next(error); }
  });

  app.post('/api/v2/waha/session/stop', requireV2Auth, requireRole('admin', 'supervisor'), async (req, res, next) => {
    try { const config = await workspaceWahaConfig(req.workspaceId); res.json({ data: await stopSession(config.session, config) }); } catch (error) { next(error); }
  });

  app.get('/api/v2/waha/qr', requireV2Auth, async (req, res, next) => {
    try { const config = await workspaceWahaConfig(req.workspaceId); res.json({ data: await getQr(config.session, config) }); } catch (error) { next(error); }
  });

  app.post('/api/v2/waha/send', requireV2Auth, requireRole('admin', 'supervisor', 'advisor'), async (req, res, next) => {
    const { conversation_id: conversationId, body, reply_to: replyTo = null } = req.body || {};
    if (!conversationId || !String(body || '').trim()) return res.status(400).json({ error: 'conversation_id y body son obligatorios' });
    try {
      const conversation = await query(
        `SELECT c.id, c.provider_conversation_id, ct.phone_e164
         FROM conversations c JOIN contacts ct ON ct.id = c.contact_id
         WHERE c.id = $1 AND c.workspace_id = $2 AND c.channel = 'whatsapp'`,
        [conversationId, req.workspaceId]
      );
       const row = conversation.rows[0];
       const chatId = outboundChatId(row?.provider_conversation_id, row?.phone_e164);
       if (!row) return res.status(404).json({ error: 'Conversación WAHA no encontrada' });
       if (!chatId) return res.status(422).json({ error: 'Este chat usa un identificador WAHA sin teléfono asociado; sincroniza los contactos de WAHA antes de enviar.' });
      const config = await workspaceWahaConfig(req.workspaceId);
      const result = await sendText({ session: config.session, wahaConfig: config, chatId, text: String(body).trim(), replyTo });
      const inserted = await query(
        `INSERT INTO messages (workspace_id,conversation_id,direction,channel,body,provider_message_id,delivery_status,created_by)
         VALUES ($1,$2,'outbound','whatsapp',$3,$4,'sent',$5) RETURNING *`,
        [req.workspaceId, conversationId, String(body).trim(), result?.id || result?.messageId || null, req.user.sub]
      );
      await query(`UPDATE conversations SET last_activity_at=now(), updated_at=now() WHERE id=$1 AND workspace_id=$2`, [conversationId, req.workspaceId]);
      res.status(201).json({ data: inserted.rows[0] });
    } catch (error) { next(error); }
  });

  app.post('/api/v2/waha/send-file', requireV2Auth, requireRole('admin', 'supervisor', 'advisor'), async (req, res, next) => {
    const { conversation_id: conversationId, file, caption = '', reply_to: replyTo = null } = req.body || {};
    if (!conversationId || !file?.data || !file?.filename) return res.status(400).json({ error: 'conversation_id y archivo son obligatorios' });
    if (String(file.data).length > 14 * 1024 * 1024) return res.status(413).json({ error: 'El archivo no puede superar 10 MB' });
    try {
      const conversation = await query(
        `SELECT c.id, c.provider_conversation_id, ct.phone_e164
         FROM conversations c JOIN contacts ct ON ct.id = c.contact_id
         WHERE c.id = $1 AND c.workspace_id = $2 AND c.channel = 'whatsapp'`,
        [conversationId, req.workspaceId]
      );
       const row = conversation.rows[0];
       const chatId = outboundChatId(row?.provider_conversation_id, row?.phone_e164);
       if (!row) return res.status(404).json({ error: 'Conversación WAHA no encontrada' });
       if (!chatId) return res.status(422).json({ error: 'Este chat usa un identificador WAHA sin teléfono asociado; sincroniza los contactos de WAHA antes de enviar.' });
      const config = await workspaceWahaConfig(req.workspaceId);
      const result = await sendFile({ session: config.session, wahaConfig: config, chatId, file: { data: String(file.data).replace(/^data:[^;]+;base64,/, ''), mimetype: file.mimetype || 'application/octet-stream', filename: String(file.filename).slice(0, 180) }, caption: String(caption).slice(0, 2000), replyTo });
      const body = String(caption).trim() || `[archivo] ${String(file.filename).slice(0, 180)}`;
      const inserted = await query(
        `INSERT INTO messages (workspace_id,conversation_id,direction,channel,body,provider_message_id,delivery_status,created_by)
         VALUES ($1,$2,'outbound','whatsapp',$3,$4,'sent',$5) RETURNING *`,
        [req.workspaceId, conversationId, body, result?.id || result?.messageId || null, req.user.sub]
      );
      await query(`UPDATE conversations SET last_activity_at=now(), updated_at=now() WHERE id=$1 AND workspace_id=$2`, [conversationId, req.workspaceId]);
      res.status(201).json({ data: inserted.rows[0] });
    } catch (error) { next(error); }
  });

  app.post('/api/v2/waha/webhook', async (req, res) => {
    const event = req.body || {};
    const workspaceId = await resolveWebhookWorkspace(event, req).catch(() => null);
    if (!workspaceId) return res.status(401).json({ error: 'Webhook no autorizado o workspace no configurado' });
    if (event.event === 'message' || event.event === 'message.any') {
      const payload = event.payload || {};
      const chatId = payload.fromMe && payload.to && payload.to !== 'me' ? payload.to : payload.from;
      const config = await workspaceWahaConfig(workspaceId);
      const contact = await resolveWebhookContact(config, chatId);
      const conversationId = await persistWahaMessage({ ...event, workspaceId, chatPhone: contact.phone, chatName: contact.name });
      console.info('[WAHA webhook] mensaje persistido', { event: event.event, workspaceId, conversationId, providerMessageId: payload.id || null });
      return res.status(200).json({ received: true, conversation_id: conversationId });
    }
    if (event.event === 'message.ack') {
      await persistWahaAck(workspaceId, event.payload);
    }
    res.status(200).json({ received: true });
  });
}

module.exports = { registerWahaRoutes, phoneFromChatId, chatIdFromPhone, outboundChatId };
