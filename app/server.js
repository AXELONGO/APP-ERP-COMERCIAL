const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { reportBug } = require('./utils/bugReporter');
const fileUpload = require('express-fileupload');
const { registerModules } = require('./routes/modules');
const { registerDashboard } = require('./routes/dashboard');
const { registerWebhookProxy } = require('./routes/webhookProxy');
const { registerCotizacionesRoutes } = require('./routes/cotizaciones');
const { registerArchivosRoutes } = require('./routes/archivos');
const { registerCalendlyRoutes } = require('./routes/calendly');
const { getAuthUrl, saveTokenFromCode } = require('./config/drive');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  reportBug({ level: 'critical', message: 'Uncaught Exception: ' + err.message, error: err })
    .finally(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  reportBug({ level: 'critical', message: 'Unhandled Rejection: ' + (reason?.message || reason), error: reason });
});

const originalDateNow = Date.now;
let timeOffset = 0;
(async function syncClock() {
  try {
    const res = await fetch('http://worldtimeapi.org/api/timezone/Etc/UTC');
    const data = await res.json();
    const realTime = new Date(data.utc_datetime).getTime();
    timeOffset = realTime - originalDateNow();
    Date.now = () => originalDateNow() + timeOffset;
    console.log(`\n[Seguridad] Reloj interno sincronizado. Offset: ${timeOffset}ms\n`);
  } catch (err) {
    console.error('[Seguridad] Fallo al sincronizar reloj:', err.message);
  }
})();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Demasiadas peticiones desde esta IP.' }
});
app.use(limiter);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  abortOnLimit: true,
  responseOnLimit: 'El archivo excede el límite de 50MB',
}));
app.use(express.static(path.join(__dirname, '../public')));

registerModules(app);
registerDashboard(app);
registerWebhookProxy(app);
registerCotizacionesRoutes(app);
registerArchivosRoutes(app);
registerCalendlyRoutes(app);

// ── Google Drive OAuth ──────────────────────────────────────
app.get('/api/auth/google', (req, res) => {
  res.redirect(getAuthUrl());
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Código de autorización faltante');
  try {
    await saveTokenFromCode(code);
    res.send(`
      <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f9fafb;">
        <div style="text-align:center;padding:40px;border-radius:16px;background:white;box-shadow:0 4px 24px rgba(0,0,0,.08);">
          <h1 style="color:#10b981;">✅ Google Drive conectado</h1>
          <p style="color:#6b7280;margin:16px 0;">Ya puedes subir archivos y facturas a Google Drive.</p>
          <a href="/" style="color:#3b82f6;">Volver al ERP</a>
        </div>
      </body></html>
    `);
  } catch (e) {
    res.status(500).send(`Error al conectar Google Drive: ${e.message}`);
  }
});

app.use(notFoundHandler);
app.use(globalErrorHandler);

app.listen(PORT, () => console.log(`\n🚀 ERP LUMARK → http://localhost:${PORT}\n`));

module.exports = app;