// middleware/errorHandler.js
const { reportBug } = require('../utils/bugReporter');

// Middleware para capturar errores de Express (4 parámetros = error handler)
const globalErrorHandler = async (err, req, res, next) => {
  const context = {
    route: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
    userId: req.user?.id || 'anonymous',
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };

  await reportBug({
    level: err.status >= 500 ? 'critical' : 'error',
    message: err.message,
    error: err,
    context
  });

  res.status(err.status || 500).json({
    success: false,
    message: (process.env.NODE_ENV === 'production' && !err.message.includes('[AUTH]'))
      ? 'Error interno del servidor' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

// Middleware para capturar 404
const notFoundHandler = async (req, res, next) => {
  await reportBug({
    level: 'warning',
    message: `Ruta no encontrada: ${req.method} ${req.path}`,
    context: { route: req.path, method: req.method }
  });
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
};

module.exports = { globalErrorHandler, notFoundHandler };
