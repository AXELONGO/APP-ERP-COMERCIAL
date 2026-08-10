const { getPool } = require('../config/database');

const startedAt = new Date().toISOString();
const build = process.env.APP_BUILD || process.env.GIT_COMMIT || process.env.COMMIT_SHA || 'local';

function registerHealthRoutes(app) {
  app.get('/healthz', async (req, res) => {
    let database = 'ok';
    try {
      await getPool().query('SELECT 1');
    } catch (error) {
      database = 'error';
      return res.status(503).json({ status: 'degraded', database, build, started_at: startedAt, uptime_seconds: Math.floor(process.uptime()) });
    }
    res.json({ status: 'ok', database, build, started_at: startedAt, uptime_seconds: Math.floor(process.uptime()) });
  });
}

module.exports = { registerHealthRoutes };
