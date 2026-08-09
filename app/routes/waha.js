const { query, getPool } = require('../config/database');
const { requireV2Auth, requireRole } = require('../middleware/v2Auth');
const {
  getWahaConfig,
  getSession,
  configureAndStartSession,
  stopSession,
  getQr,
  sendText,
} = require('../services/wahaClient');
const { getIntegrationConfig } = require('../services/integrationConfig');

function phoneFromChatId(chatId) {
  const value = String(chatId || '').trim();
  if (!value || !value.endsWith('@c.us')) return null;
  const digits = value.slice(0, -5).replace(/\D/g, '');
  return digits ? `+${digits}` : null;
}

function chatIdFromPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `${digits}@c.us` : null;
}

function webhookSecretMatches(req) {
  const expected = process.env.WAHA_WEBHOOK_SECRET || '';
  return !expected || req.get('x-erp-webhook-secret') === expected;
}

async function workspaceWahaConfig(workspaceId) {
  const saved = await getIntegrationConfig(workspaceId, 'waha');
  return { ...getWahaConfig(), ...(saved.config || {}) };
}

async function ensureConversation(client, workspaceId, chatId, displayName) {
  const phone = phoneFromChatId(chatId);
  if (!phone) return null;
  const contactResult = await client.query(
    `INSERT INTO contacts (workspace_id, name, phone_e164, source)
     VALUES ($1,$2,$3,'whatsapp')
     ON CONFLICT (workspace_id, phone_e164) DO UPDATE SET
       name = CASE WHEN contacts.name = contacts.phone_e164 THEN EXCLUDED.name ELSE contacts.name END,
       updated_at = now()
     RETURNING id, name, phone_e164`,
    [workspaceId, displayName || phone, phone]
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
  return existing.rows[0] || null;
}

async function persistWahaMessage(event) {
  const payload = event?.payload || {};
  const chatId = payload.fromMe ? payload.to : payload.from;
  const conversationId = chatId && event.workspaceId
    ? await persistMessageForWorkspace(event.workspaceId, chatId, payload)
    : null;
  return conversationId;
}

async function persistMessageForWorkspace(workspaceId, chatId, payload) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const name = payload._data?.notifyName || payload._data?.pushName || payload.pushName || phoneFromChatId(chatId);
    const conversation = await ensureConversation(client, workspaceId, chatId, name);
    if (!conversation) { await client.query('ROLLBACK'); return null; }
    const body = payload.body || (payload.hasMedia ? `[${payload.media?.mimetype || 'media'}]` : '[mensaje sin texto]');
    const inserted = await client.query(
      `INSERT INTO messages (workspace_id, conversation_id, direction, channel, body, provider_message_id, delivery_status)
       VALUES ($1,$2,$3,'whatsapp',$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
      [workspaceId, conversation.id, payload.fromMe ? 'outbound' : 'inbound', body, payload.id || null, payload.fromMe ? 'sent' : 'received']
    );
    await client.query(
      `UPDATE conversations SET last_activity_at = now(), updated_at = now(),
       status = CASE WHEN $2 = 'inbound' THEN 'open' ELSE status END
       WHERE id = $1 AND workspace_id = $3`,
      [conversation.id, payload.fromMe ? 'outbound' : 'inbound', workspaceId]
    );
    if (inserted.rows[0]) {
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
      const chatId = row?.provider_conversation_id || chatIdFromPhone(row?.phone_e164);
      if (!row || !chatId) return res.status(404).json({ error: 'Conversación WAHA no encontrada' });
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

  app.post('/api/v2/waha/webhook', async (req, res) => {
    if (!webhookSecretMatches(req)) return res.status(401).json({ error: 'Webhook no autorizado' });
    const event = req.body || {};
    if (event.event === 'message' || event.event === 'message.any') {
      const workspaceId = process.env.WAHA_WORKSPACE_ID;
      if (workspaceId) await persistWahaMessage({ ...event, workspaceId });
    }
    if (event.event === 'message.ack' && process.env.WAHA_WORKSPACE_ID) {
      await persistWahaAck(process.env.WAHA_WORKSPACE_ID, event.payload);
    }
    res.status(200).json({ received: true });
  });
}

module.exports = { registerWahaRoutes, phoneFromChatId, chatIdFromPhone };
