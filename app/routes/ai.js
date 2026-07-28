const asyncHandler = require('../middleware/asyncHandler');
const rateLimit = require('express-rate-limit');
const { CommunicationAgent, MODULES } = require('../services/communicationAgent');

const agent = new CommunicationAgent();
const communicationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes al asistente IA. Intenta más tarde.' }
});

function registerAiRoutes(app) {
  app.get('/api/ai/status', (req, res) => {
    res.json({
      ...agent.configuration(),
      modules: Object.keys(MODULES)
    });
  });

  app.post('/api/ai/communication', communicationLimiter, asyncHandler(async (req, res) => {
    const message = String(req.body?.message || '').trim();
    const module = String(req.body?.module || '').trim().toLowerCase() || null;
    const recordId = String(req.body?.record_id || '').trim() || null;

    if (!message) return res.status(400).json({ error: 'Escribe qué comunicación necesitas preparar.' });
    if (message.length > 2000) return res.status(400).json({ error: 'La solicitud no puede superar 2000 caracteres.' });
    if (module && !MODULES[module]) return res.status(400).json({ error: 'El módulo de contexto no es válido.' });

    try {
      const response = await agent.run({
        message,
        module,
        recordId,
        channel: req.body?.channel,
        tone: req.body?.tone,
        history: Array.isArray(req.body?.history) ? req.body.history : []
      });
      res.json({ success: true, ...response });
    } catch (error) {
      if (error.code === 'AI_COMMUNICATION_DISABLED') {
        return res.status(503).json({ error: error.message, code: error.code });
      }
      throw error;
    }
  }));
}

module.exports = { registerAiRoutes };
