const { requireV2Auth, requireRole } = require('../middleware/v2Auth');
const { INTEGRATION_DEFINITIONS, getIntegrationConfig, saveIntegrationConfig, publicIntegrationConfig, definitionFor } = require('../services/integrationConfig');
const { getSession } = require('../services/wahaClient');

function registerIntegrationRoutes(app) {
  app.get('/api/v2/integrations', requireV2Auth, async (req, res, next) => {
    try {
      const data = await Promise.all(Object.keys(INTEGRATION_DEFINITIONS).map(async provider => publicIntegrationConfig(await getIntegrationConfig(req.workspaceId, provider))));
      res.json({ data });
    } catch (error) { next(error); }
  });

  app.get('/api/v2/integrations/:provider', requireV2Auth, async (req, res, next) => {
    try {
      const saved = await getIntegrationConfig(req.workspaceId, req.params.provider);
      res.json({ data: publicIntegrationConfig(saved) });
    } catch (error) { next(error); }
  });

  app.put('/api/v2/integrations/:provider', requireV2Auth, requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
      const saved = await saveIntegrationConfig(req.workspaceId, req.params.provider, req.body || {});
      res.json({ data: publicIntegrationConfig(saved) });
    } catch (error) { next(error); }
  });

  app.post('/api/v2/integrations/:provider/test', requireV2Auth, requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
      const provider = req.params.provider;
      definitionFor(provider);
      const saved = await getIntegrationConfig(req.workspaceId, provider);
      const missing = INTEGRATION_DEFINITIONS[provider].fields.filter(([key]) => !saved.config[key]).map(([, label]) => label);
      if (missing.length) return res.status(400).json({ error: `Faltan variables: ${missing.join(', ')}` });
      if (provider === 'waha') {
        const session = await getSession(saved.config.session || 'default', saved.config);
        return res.json({ ok: true, provider, status: session.status, detail: 'WAHA respondió correctamente' });
      }
      res.json({ ok: true, provider, detail: 'Variables guardadas y validadas' });
    } catch (error) { next(error); }
  });
}

module.exports = { registerIntegrationRoutes };
