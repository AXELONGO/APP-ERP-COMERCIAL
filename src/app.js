const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const env = require('./config/env');

const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const registerModules = require('./modules');

// Routers
const dashboardRouter = require('./routes/dashboard');
const webhookProxyRouter = require('./routes/webhookProxy');
const healthRouter = require('./routes/health');
const trackerRouter = require('./routes/tracker');
const calendlyRouter = require('./routes/calendly');
const authRouter = require('./routes/auth');
const configRouter = require('./routes/config');
const { authMiddleware } = require('./middleware/auth');

const app = express();

// ─── SEGURIDAD Y PERFORMANCE ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: { error: 'Demasiadas peticiones desde esta IP. Por favor intenta de nuevo en 15 minutos.' }
});
// Solo aplicar el rate limiter a la API, no a los archivos estáticos
app.use('/api', limiter);

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? ['https://tulink.com', 'https://www.tulink.com'] : '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// ─── RUTAS PÚBLICAS ──────────────────────────────────────────
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/config', configRouter); // Para que el frontend obtenga el logo antes del login
app.use('/api/webhook-proxy', webhookProxyRouter);
app.use('/api/sync-calendly', calendlyRouter);

// ─── RUTAS PROTEGIDAS ────────────────────────────────────────
app.use('/api/dashboard', authMiddleware, dashboardRouter);
app.use('/api/tracker', authMiddleware, trackerRouter);

// ─── RUTAS CRUD (MÓDULOS PROTEGIDOS) ─────────────────────────
const apiRouter = express.Router();
apiRouter.use(authMiddleware); // Proteger todos los CRUD
registerModules(apiRouter);
app.use('/api', apiRouter);

// ─── MANEJO DE ERRORES ────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
