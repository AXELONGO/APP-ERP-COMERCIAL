const INFORMATION_WEBHOOK_URL = process.env.N8N_INFORMATION_WEBHOOK_URL || 'https://chatbot-n8n.or7bqd.easypanel.host/webhook/information';

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/password|token|secret|credential|private[_-]?key|authorization/i.test(key)) return [key, '[REDACTED]'];
    return [key, sanitize(item)];
  }));
}

async function sendInformationEvent(payload) {
  try {
    const response = await fetch(INFORMATION_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: `erp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sent_at: new Date().toISOString(),
        source: 'erp-lumark',
        ...sanitize(payload)
      })
    });
    if (!response.ok) console.error(`[Webhook] HTTP ${response.status} al enviar evento`);
  } catch (error) {
    console.error('[Webhook] No se pudo enviar evento:', error.message);
  }
}

async function reportBug({ level, message, error, context }) {
  console.error(`[BugReporter] ${level}: ${message}`);
  await sendInformationEvent({
    event_type: 'system.error',
    level,
    message,
    error: error ? { name: error.name, stack: error.stack } : null,
    context: context || null
  });
}

function reportModification({ method, path, status, body, response }) {
  return sendInformationEvent({
    event_type: 'data.modified',
    modification: { method, path, status },
    data: body || {},
    response: response || null
  });
}

module.exports = { reportBug, reportModification, sendInformationEvent };
