const asyncHandler = require('../middleware/asyncHandler');

function registerWebhookProxy(app) {
  app.post('/api/webhook-proxy', asyncHandler(async (req, res) => {
    const { url, payload } = req.body;
    if (!url || typeof url !== 'string' || !/^https:\/\//i.test(url)) {
      return res.status(400).json({ success: false, error: 'URL de webhook inválida' });
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.ok ? 200 : response.status).json({ success: response.ok, status: response.status, data });
  }));
}

module.exports = { registerWebhookProxy };
