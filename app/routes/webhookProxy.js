const asyncHandler = require('../middleware/asyncHandler');

function registerWebhookProxy(app) {
  app.post('/api/webhook-proxy', asyncHandler(async (req, res) => {
    const { url, payload } = req.body;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    res.json({ success: response.ok, status: response.status, data });
  }));
}

module.exports = { registerWebhookProxy };