const DEFAULT_SESSION = 'default';

function getWahaConfig() {
  return {
    baseUrl: String(process.env.WAHA_BASE_URL || '').replace(/\/$/, ''),
    apiKey: process.env.WAHA_API_KEY || '',
    session: process.env.WAHA_SESSION || DEFAULT_SESSION,
  };
}

function assertConfigured() {
  const config = getWahaConfig();
  if (!config.baseUrl) throw new Error('WAHA_BASE_URL no está configurada');
  return config;
}

async function requestWaha(path, options = {}) {
  const config = assertConfigured();
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(config.apiKey ? { 'X-Api-Key': config.apiKey } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${config.baseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.message || data?.error || `WAHA respondió HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function jsonOptions(method, body) {
  return { method, body: body === undefined ? undefined : JSON.stringify(body) };
}

function sessionPath(session, action = '') {
  return `/api/sessions/${encodeURIComponent(session)}${action ? `/${action}` : ''}`;
}

async function getSessions() {
  return requestWaha('/api/sessions?all=true');
}

async function getSession(session = getWahaConfig().session) {
  return requestWaha(sessionPath(session));
}

async function configureAndStartSession({ webhookUrl, webhookSecret } = {}) {
  const config = getWahaConfig();
  const webhooks = webhookUrl ? [{
    url: webhookUrl,
    events: ['message', 'message.ack', 'session.status'],
    ...(webhookSecret ? { customHeaders: [{ name: 'X-ERP-Webhook-Secret', value: webhookSecret }] } : {}),
  }] : [];
  const payload = {
    name: config.session,
    config: {
      webhooks,
      ignore: { status: true, groups: false, channels: true, broadcast: true },
      noweb: { store: { enabled: true, fullSync: false } },
    },
  };
  const sessions = await getSessions();
  const exists = Array.isArray(sessions) && sessions.some(item => item.name === config.session);
  if (exists) await requestWaha(sessionPath(config.session), { ...jsonOptions('PUT', payload) });
  else await requestWaha('/api/sessions', { ...jsonOptions('POST', payload) });
  return requestWaha(sessionPath(config.session, 'start'), { method: 'POST' });
}

async function stopSession(session = getWahaConfig().session) {
  return requestWaha(sessionPath(session, 'stop'), { method: 'POST' });
}

async function getQr(session = getWahaConfig().session) {
  return requestWaha(`/api/${encodeURIComponent(session)}/auth/qr`, { method: 'POST' });
}

async function sendText({ session = getWahaConfig().session, chatId, text, replyTo } = {}) {
  return requestWaha('/api/sendText', {
    ...jsonOptions('POST', { session, chatId, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
}

module.exports = {
  getWahaConfig,
  requestWaha,
  getSessions,
  getSession,
  configureAndStartSession,
  stopSession,
  getQr,
  sendText,
};
