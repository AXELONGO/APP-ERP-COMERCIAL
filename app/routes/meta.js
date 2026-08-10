const crypto = require('crypto');
const { query } = require('../config/database');
const { requireV2Auth, requireRole } = require('../middleware/v2Auth');
const { getIntegrationConfig, saveIntegrationConfig } = require('../services/integrationConfig');
const { signToken, verifyToken } = require('../auth/tokens');
const { metaOAuthUrl, exchangeCode, listPages, sendMessage, verifySignature } = require('../services/metaClient');

function badRequest(message, status = 400) { const error = new Error(message); error.status = status; return error; }
function webhookObjectChannel(object) { return object === 'instagram' ? 'instagram' : 'messenger'; }
function eventId(channel, entry, message) { return message?.mid || `${channel}:${entry?.id || 'unknown'}:${message?.sender?.id || 'unknown'}:${message?.timestamp || Date.now()}`; }

async function metaWorkspace(workspaceId) {
  const saved = await getIntegrationConfig(workspaceId, 'meta');
  if (!saved.enabled) throw badRequest('La integración Meta no está activada', 503);
  return saved;
}

async function resolveWebhookConfig(req, body) {
  const requestedWorkspace = String(req.query.workspace_id || '').trim();
  if (requestedWorkspace) return { workspaceId: requestedWorkspace, config: await getIntegrationConfig(requestedWorkspace, 'meta') };
  const object = body?.object;
  const entryId = body?.entry?.[0]?.id;
  if (!entryId) return null;
  const result = await query(`SELECT workspace_id FROM integration_configs WHERE provider='meta' AND enabled=true AND (config->>'pageId'=$1 OR config->>'instagramAccountId'=$1) LIMIT 1`, [entryId]);
  if (!result.rows[0]) return null;
  return { workspaceId: result.rows[0].workspace_id, config: await getIntegrationConfig(result.rows[0].workspace_id, 'meta') };
}

async function persistMetaMessage(workspaceId, channel, entry, messaging) {
  const senderId = messaging?.sender?.id;
  const message = messaging?.message;
  if (!senderId || !message?.mid) return null;
  const externalContactId = `meta:${channel}:${senderId}`;
  const contact = await query(
    `INSERT INTO contacts (workspace_id,name,phone_e164,source,channel,custom_fields)
     VALUES ($1,$2,$3,'meta',$4,$5)
     ON CONFLICT (workspace_id,phone_e164) DO UPDATE SET channel=EXCLUDED.channel,custom_fields=contacts.custom_fields || EXCLUDED.custom_fields,updated_at=now()
     RETURNING id`,
    [workspaceId, `Meta ${channel}`, externalContactId, channel, { meta_channel: channel, meta_user_id: senderId }]
  );
  const contactId = contact.rows[0].id;
  const providerConversationId = `meta:${channel}:${senderId}`;
  const conversation = await query(
    `INSERT INTO conversations (workspace_id,contact_id,channel,provider_conversation_id,status,last_activity_at)
     VALUES ($1,$2,$3,$4,'open',now())
     ON CONFLICT (workspace_id,provider_conversation_id) DO UPDATE SET contact_id=EXCLUDED.contact_id,last_activity_at=now(),updated_at=now(),status='open'
     RETURNING id`,
    [workspaceId, contactId, channel, providerConversationId]
  );
  const conversationId = conversation.rows[0].id;
  const inserted = await query(
    `INSERT INTO messages (workspace_id,conversation_id,direction,channel,body,provider_message_id,delivery_status,created_at)
     VALUES ($1,$2,'inbound',$3,$4,$5,'received',to_timestamp($6 / 1000.0))
     ON CONFLICT (workspace_id,provider_message_id) DO NOTHING RETURNING id`,
    [workspaceId, conversationId, channel, message.text || '[mensaje Meta sin texto]', message.mid, Number(messaging.timestamp || Date.now())]
  );
  await query(`UPDATE conversations SET last_activity_at=now(),updated_at=now(),status='open' WHERE id=$1 AND workspace_id=$2`, [conversationId, workspaceId]);
  return { conversationId, inserted: Boolean(inserted.rows[0]), providerMessageId: message.mid };
}

function registerMetaRoutes(app) {
  app.get('/api/v2/meta/status', requireV2Auth, async (req, res, next) => {
    try {
      const saved = await getIntegrationConfig(req.workspaceId, 'meta');
      res.json({ data: { enabled: saved.enabled, configured: Boolean(saved.config.appId && saved.config.webhookUrl), page: saved.config.pageName || null, pageId: saved.config.pageId || null, instagramAccountId: saved.config.instagramAccountId || null } });
    } catch (error) { next(error); }
  });

  app.get('/api/v2/meta/oauth-url', requireV2Auth, requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
      const saved = await metaWorkspace(req.workspaceId);
      if (!saved.config.appId || !saved.config.redirectUri) throw badRequest('Configura META_APP_ID y redirectUri antes de conectar Meta');
      const state = signToken({ type: 'meta_oauth', workspace_id: req.workspaceId, exp: Math.floor(Date.now() / 1000) + 600 });
      res.json({ url: metaOAuthUrl({ appId: saved.config.appId, redirectUri: saved.config.redirectUri, state }) });
    } catch (error) { next(error); }
  });

  app.get('/api/v2/meta/oauth/callback', async (req, res, next) => {
    try {
      const state = verifyToken(req.query.state);
      if (!state || state.type !== 'meta_oauth' || !state.workspace_id) throw badRequest('Estado OAuth de Meta inválido o expirado');
      if (!req.query.code) throw badRequest('Meta no devolvió un código OAuth');
      const saved = await metaWorkspace(state.workspace_id);
      const token = await exchangeCode({ appId: saved.config.appId, appSecret: saved.config.appSecret, redirectUri: saved.config.redirectUri, code: req.query.code });
      const pages = await listPages(token.access_token);
      const page = (pages.data || []).find(item => item.id === saved.config.pageId) || pages.data?.[0];
      if (!page) throw badRequest('Meta no devolvió ninguna página disponible');
      await saveIntegrationConfig(state.workspace_id, 'meta', { enabled: true, userAccessToken: token.access_token, pageId: page.id, pageName: page.name, pageAccessToken: page.access_token, instagramAccountId: page.instagram_business_account?.id || '', instagramAccessToken: page.access_token });
      res.type('html').send('<!doctype html><html lang="es"><meta charset="utf-8"><title>Meta conectado</title><body style="font-family:Arial;padding:40px;text-align:center"><h1>Meta conectado</h1><p>La página y la cuenta de Instagram ya están disponibles para el ERP.</p><a href="/">Volver al ERP</a></body></html>');
    } catch (error) { next(error); }
  });

  app.get('/api/v2/meta/webhook', async (req, res) => {
    const config = await resolveWebhookConfig(req, { entry: [{ id: req.query.workspace_id }] }).catch(() => null);
    if (!config?.config?.verifyToken || req.query['hub.verify_token'] !== config.config.verifyToken) return res.sendStatus(403);
    return res.status(200).send(req.query['hub.challenge'] || '');
  });

  app.post('/api/v2/meta/webhook', async (req, res, next) => {
    try {
      const resolved = await resolveWebhookConfig(req, req.body);
      if (!resolved) return res.sendStatus(404);
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
      if (!verifySignature(rawBody, req.get('x-hub-signature-256'), resolved.config.appSecret)) return res.sendStatus(403);
      const channel = webhookObjectChannel(req.body.object);
      for (const entry of req.body.entry || []) for (const messaging of entry.messaging || []) {
        const id = eventId(channel, entry, messaging.message);
        const hash = crypto.createHash('sha256').update(JSON.stringify(messaging)).digest('hex');
        const claimed = await query(`INSERT INTO meta_webhook_events (workspace_id,provider,external_event_id,payload_hash,status) VALUES ($1,$2,$3,$4,'received') ON CONFLICT (workspace_id,provider,external_event_id) DO NOTHING RETURNING id`, [resolved.workspaceId, channel, id, hash]);
        if (!claimed.rows[0]) continue;
        try { await persistMetaMessage(resolved.workspaceId, channel, entry, messaging); await query(`UPDATE meta_webhook_events SET status='processed',processed_at=now() WHERE id=$1`, [claimed.rows[0].id]); }
        catch (error) { await query(`UPDATE meta_webhook_events SET status='failed',error=$1 WHERE id=$2`, [error.message, claimed.rows[0].id]); throw error; }
      }
      res.json({ received: true });
    } catch (error) { next(error); }
  });

  app.post('/api/v2/meta/send', requireV2Auth, requireRole('admin', 'supervisor', 'advisor'), async (req, res, next) => {
    try {
      const body = String(req.body?.body || '').trim();
      if (!req.body?.conversation_id || !body) throw badRequest('conversation_id y body son obligatorios');
      const conversation = await query(`SELECT c.id,c.channel,c.provider_conversation_id,c.workspace_id FROM conversations c WHERE c.id=$1 AND c.workspace_id=$2 AND c.channel IN ('messenger','instagram')`, [req.body.conversation_id, req.workspaceId]);
      if (!conversation.rows[0]) throw badRequest('Conversación Meta no encontrada', 404);
      const recipientId = conversation.rows[0].provider_conversation_id.split(':').slice(2).join(':');
      const config = await metaWorkspace(req.workspaceId);
      const result = await sendMessage({ channel: conversation.rows[0].channel, recipientId, text: body, pageId: config.config.pageId, instagramAccountId: config.config.instagramAccountId, pageAccessToken: config.config.pageAccessToken, instagramAccessToken: config.config.instagramAccessToken });
      const inserted = await query(`INSERT INTO messages (workspace_id,conversation_id,direction,channel,body,provider_message_id,delivery_status,created_by) VALUES ($1,$2,'outbound',$3,$4,$5,'sent',$6) RETURNING *`, [req.workspaceId, conversation.rows[0].id, conversation.rows[0].channel, body, result.message_id || result.id || null, req.user.sub]);
      await query(`UPDATE conversations SET last_activity_at=now(),updated_at=now() WHERE id=$1 AND workspace_id=$2`, [conversation.rows[0].id, req.workspaceId]);
      res.status(201).json({ data: inserted.rows[0] });
    } catch (error) { next(error); }
  });
}

module.exports = { registerMetaRoutes, persistMetaMessage };
