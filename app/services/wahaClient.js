const DEFAULT_SESSION = 'default';

function getWahaConfig(overrides = {}) {
  return {
    baseUrl: String(process.env.WAHA_BASE_URL || '').replace(/\/$/, ''),
    apiKey: process.env.WAHA_API_KEY || '',
    session: process.env.WAHA_SESSION || DEFAULT_SESSION,
    ...overrides,
  };
}

function assertConfigured(overrides = {}) {
  const config = getWahaConfig(overrides);
  if (!config.baseUrl) throw new Error('WAHA_BASE_URL no está configurada');
  return config;
}

async function requestWaha(path, options = {}) {
  const { wahaConfig = {}, ...requestOptions } = options;
  const config = assertConfigured(wahaConfig);
  const headers = {
    Accept: 'application/json',
    ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
    ...(config.apiKey ? { 'X-Api-Key': config.apiKey } : {}),
    ...(requestOptions.headers || {}),
  };
  const response = await fetch(`${config.baseUrl}${path}`, { ...requestOptions, headers });
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

function chatPath(session, chatId = '') {
  return `/api/${encodeURIComponent(session)}/chats${chatId ? `/${encodeURIComponent(chatId)}` : ''}`;
}

async function getSessions(wahaConfig = {}) {
  return requestWaha('/api/sessions?all=true', { wahaConfig });
}

async function getSession(session = getWahaConfig().session, wahaConfig = {}) {
  return requestWaha(sessionPath(session), { wahaConfig });
}

async function getChats(session = getWahaConfig().session, wahaConfig = {}, { limit = 100, offset = 0 } = {}) {
  return requestWaha(`${chatPath(session)}?limit=${limit}&offset=${offset}&sortBy=conversationTimestamp&sortOrder=desc`, { wahaConfig });
}

async function getChatMessages(session, chatId, wahaConfig = {}, { limit = 100, offset = 0 } = {}) {
  return requestWaha(`${chatPath(session, chatId)}/messages?limit=${limit}&offset=${offset}&downloadMedia=false`, { wahaConfig });
}

async function getLidPhone(session, lid, wahaConfig = {}) {
  return requestWaha(`/api/${encodeURIComponent(session)}/lids/${encodeURIComponent(lid)}`, { wahaConfig });
}

async function configureAndStartSession({ webhookUrl, webhookSecret, wahaConfig = {} } = {}) {
  const config = getWahaConfig(wahaConfig);
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
  const sessions = await getSessions(config);
  const exists = Array.isArray(sessions) && sessions.some(item => item.name === config.session);
  if (exists) await requestWaha(sessionPath(config.session), { ...jsonOptions('PUT', payload), wahaConfig: config });
  else await requestWaha('/api/sessions', { ...jsonOptions('POST', payload), wahaConfig: config });
  return requestWaha(sessionPath(config.session, 'start'), { method: 'POST', wahaConfig: config });
}

async function stopSession(session = getWahaConfig().session, wahaConfig = {}) {
  return requestWaha(sessionPath(session, 'stop'), { method: 'POST', wahaConfig });
}

async function getQr(session = getWahaConfig().session, wahaConfig = {}) {
  return requestWaha(`/api/${encodeURIComponent(session)}/auth/qr`, { method: 'POST', wahaConfig });
}

async function sendText({ session = getWahaConfig().session, chatId, text, replyTo, wahaConfig = {} } = {}) {
  return requestWaha('/api/sendText', {
    ...jsonOptions('POST', { session, chatId, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    wahaConfig,
  });
}

async function sendFile({ session = getWahaConfig().session, chatId, file, caption, replyTo, wahaConfig = {} } = {}) {
  return requestWaha('/api/sendFile', {
    ...jsonOptions('POST', { session, chatId, file, ...(caption ? { caption } : {}), ...(replyTo ? { reply_to: replyTo } : {}) }),
    wahaConfig,
  });
}

module.exports = {
  getWahaConfig,
  requestWaha,
  getSessions,
  getSession,
  getChats,
  getChatMessages,
  getLidPhone,
  configureAndStartSession,
  stopSession,
  getQr,
  sendText,
  sendFile,
};
