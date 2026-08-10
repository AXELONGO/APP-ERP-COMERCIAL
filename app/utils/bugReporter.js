const crypto = require('crypto');

const INFORMATION_WEBHOOK_URL = process.env.N8N_INFORMATION_WEBHOOK_URL || 'https://chatbot-n8n.or7bqd.easypanel.host/webhook/information';
const MOVEMENTS_WEBHOOK_URL = process.env.N8N_MOVEMENTS_WEBHOOK_URL || INFORMATION_WEBHOOK_URL;
const BUGS_WEBHOOK_URL = process.env.N8N_BUGS_WEBHOOK_URL || INFORMATION_WEBHOOK_URL;
const recentBugReports = new Map();
const webhookCircuit = new Map();
const BUG_DEDUP_WINDOW_MS = 5 * 60 * 1000;
const WEBHOOK_COOLDOWN_MS = 60 * 1000;

function getEnvironment() {
  return process.env.NODE_ENV === 'production' ? 'produccion' : 'desarrollo';
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/password|token|secret|credential|private[_-]?key|authorization|cookie/i.test(key)) return [key, '[REDACTED]'];
    return [key, sanitize(item)];
  }));
}

function generateEventId(prefix = 'erp') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractErrorLocation(stack) {
  if (!stack) return null;
  const match = String(stack).match(/((?:https?:\/\/|file:\/\/|\/)[^\s()]+):(\d+):(\d+)/);
  return match ? `${match[1]}:${match[2]}:${match[3]}` : null;
}

function createDedupKey(...parts) {
  return crypto.createHash('sha256').update(parts.map(value => String(value || '')).join('|')).digest('hex');
}

function getSeverity(level, message, eventType, status) {
  if (level === 'critical' || eventType === 'system.unhandled_rejection' || status >= 500) return 'alta';
  if (/ReferenceError|SyntaxError|TypeError/i.test(String(message)) || eventType === 'system.browser_error') return 'media';
  return 'baja';
}

function shouldReportBug({ level, context, eventType }) {
  const status = Number(context?.status || 0);
  if (eventType === 'system.browser_error' || eventType === 'system.unhandled_rejection') return true;
  if (level === 'critical') return true;
  if (level === 'not_found' || (status > 0 && status < 500)) return false;
  return true;
}

async function postWebhook(url, payload) {
  if (!url) return false;
  const circuit = webhookCircuit.get(url);
  if (circuit && circuit.openUntil > Date.now()) return false;
  const hostname = (() => { try { return new URL(url).hostname; } catch { return 'invalid-url'; } })();
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
       if (response.ok) { webhookCircuit.delete(url); return true; }
       console.error(`[Webhook] HTTP ${response.status} al enviar evento a ${hostname} (intento ${attempt}/3)`);
    } catch (error) {
      console.error(`[Webhook] No se pudo enviar evento a ${hostname} (intento ${attempt}/3):`, error.message);
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }
  webhookCircuit.set(url, { openUntil: Date.now() + WEBHOOK_COOLDOWN_MS });
  console.error(`[Webhook] Circuito abierto durante ${WEBHOOK_COOLDOWN_MS / 1000}s para ${hostname}; el ERP seguirá operando sin notificaciones externas.`);
  return false;
}

async function sendInformationEvent(payload, { channel = 'movements' } = {}) {
  const event = sanitize({
    event_id: generateEventId(),
    schema_version: '1.0',
    source: 'erp-lumark',
    environment: getEnvironment(),
    sent_at: new Date().toISOString(),
    ...payload
  });
  const url = channel === 'bugs' ? BUGS_WEBHOOK_URL : MOVEMENTS_WEBHOOK_URL;
  return postWebhook(url, event);
}

function reportBug({ level, message, error, context, eventType = 'system.server_error' }) {
  const errorMessage = message || error?.message || String(error || 'Error desconocido');
  if (!shouldReportBug({ level, context, eventType })) return Promise.resolve(false);

  const stackTrace = error?.stack || context?.stack || null;
  const errorLocation = extractErrorLocation(stackTrace);
  const dedupKey = createDedupKey(eventType, errorMessage, errorLocation);
  const lastReport = recentBugReports.get(dedupKey) || 0;
  if (Date.now() - lastReport < BUG_DEDUP_WINDOW_MS) return Promise.resolve(false);
  recentBugReports.set(dedupKey, Date.now());

  const occurredAt = new Date().toISOString();
  return sendInformationEvent({
    category: 'bug',
    module: 'sistema',
    event_type: eventType,
    trigger_source: 'error',
    record_id: null,
    button_action_id: null,
    severity: getSeverity(level, errorMessage, eventType, context?.status),
    error_message: errorMessage,
    message: errorMessage,
    error_location: errorLocation,
    stack_trace: stackTrace,
    stack: stackTrace,
    source_url: context?.source_url || process.env.APP_URL || null,
    occurred_at: occurredAt,
    dedup_key: dedupKey,
    data: {
      message: errorMessage,
      stack: stackTrace,
      ...(context || {})
    },
    level: level || 'error'
  }, { channel: 'bugs' });
}

function getModuleFromPath(path, body) {
  const endpoint = String(path || '').split('?')[0].split('/').filter(Boolean)[1] || 'sistema';
  if (endpoint === 'pipelines' && body?.record_type) return String(body.record_type);
  return {
    pipeline: 'proyectos',
    pipeline_de_proyecto: 'proyectos',
    pagos_gastos: 'pagos_gastos'
  }[endpoint] || endpoint;
}

function getMovementEventType(module, method, path) {
  const normalizedPath = String(path || '').split('?')[0];
  if (normalizedPath.includes('/transition')) return `${module}.stage_changed`;
  if (module === 'correos' && normalizedPath.endsWith('/send')) return 'correos.sent';
  if (module === 'correos' && normalizedPath.endsWith('/draft')) return 'correos.draft_created';
  const action = { POST: 'created', PUT: 'updated', PATCH: 'updated', DELETE: 'deleted' }[method] || method.toLowerCase();
  return `${module}.${action}`;
}

function getRecordIdFromPath(path) {
  const segments = String(path || '').split('?')[0].split('/').filter(Boolean);
  const candidate = segments[2];
  if (!candidate || /^(send|draft|upload|from-calendly|drive-status|auth)$/i.test(candidate)) return null;
  try {
    return decodeURIComponent(candidate);
  } catch {
    return candidate;
  }
}

function getTriggerSource(method, path, buttonActionId) {
  if (buttonActionId) return 'button';
  if (String(path || '').includes('/transition')) return 'transition';
  if (/\/api\/correos\/(send|draft)/.test(String(path || ''))) return 'button';
  if (String(path || '').includes('/from-calendly')) return 'process';
  return { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' }[method] || method.toLowerCase();
}

function compactMovementValue(value, key = '', depth = 0) {
  if (depth > 3) return '[TRUNCATED]';
  if (typeof value === 'string') {
    if (/html_body|text_body|template|content/i.test(key)) return `[OMITTED_${key.toUpperCase()}]`;
    return value.length > 2000 ? `${value.slice(0, 2000)}...[TRUNCATED]` : value;
  }
  if (Array.isArray(value)) return value.slice(0, 100).map(item => compactMovementValue(item, key, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, compactMovementValue(childValue, childKey, depth + 1)]));
  }
  return value;
}

function reportModification({ method, path, status, body, response, recordId, buttonActionId, userContext, sourceUrl }) {
  const module = getModuleFromPath(path, body);
  const resolvedRecordId = recordId || response?.id || response?.campaign_id || response?.record_id || response?.state?.record_id || body?.record_id || body?.id || getRecordIdFromPath(path) || null;
  const resolvedButtonActionId = buttonActionId || body?.button_action_id || null;
  const occurredAt = new Date().toISOString();
  const compactRequest = compactMovementValue(body || {});
  const compactResponse = compactMovementValue(response || {});
  const eventType = getMovementEventType(module, method, path);

  return sendInformationEvent({
    category: 'movimiento',
    module,
    event_type: eventType,
    trigger_source: getTriggerSource(method, path, resolvedButtonActionId),
    record_id: resolvedRecordId,
    button_action_id: resolvedButtonActionId,
    occurred_at: occurredAt,
    source_url: sourceUrl || null,
    user_context: userContext || null,
    dedup_key: createDedupKey(eventType, module, resolvedRecordId, status),
    data: {
      request: compactRequest,
      response: compactResponse,
      path,
      status
    }
  }, { channel: 'movements' });
}

module.exports = { reportBug, reportModification, sendInformationEvent, extractErrorLocation, createDedupKey };
