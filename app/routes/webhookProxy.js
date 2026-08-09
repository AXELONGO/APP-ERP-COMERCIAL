const asyncHandler = require('../middleware/asyncHandler');
const dns = require('node:dns').promises;
const net = require('node:net');
const { requireV2Auth } = require('../middleware/v2Auth');

const defaultAllowedHosts = new Set(['chatbot-n8n.or7bqd.easypanel.host']);
function allowedHosts() {
  const hosts = new Set(defaultAllowedHosts);
  for (const value of String(process.env.N8N_WEBHOOK_ALLOWLIST || '').split(',')) if (value.trim()) hosts.add(value.trim().toLowerCase());
  for (const value of Object.values(process.env).filter(item => typeof item === 'string' && item.startsWith('https://'))) {
    try { hosts.add(new URL(value).hostname.toLowerCase()); } catch (_) {}
  }
  return hosts;
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return net.isIPv6(address) && (address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:'));
}

function registerWebhookProxy(app) {
  app.post('/api/webhook-proxy', requireV2Auth, asyncHandler(async (req, res) => {
    const { url, payload } = req.body;
    let target;
    try { target = new URL(url); } catch (_) { target = null; }
    if (!target || target.protocol !== 'https:' || !allowedHosts().has(target.hostname.toLowerCase())) {
      return res.status(400).json({ success: false, error: 'URL de webhook inválida' });
    }
    const addresses = await dns.lookup(target.hostname, { all: true });
    if (addresses.some(item => isPrivateAddress(item.address))) return res.status(400).json({ success: false, error: 'Destino de webhook no permitido' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await response.text();
    let data = {};
    if (text.length <= 1024 * 1024) { try { data = JSON.parse(text || '{}'); } catch (_) { data = { body: text }; } }
    res.status(response.ok ? 200 : response.status).json({ success: response.ok, status: response.status, data });
  }));
}

module.exports = { registerWebhookProxy };
