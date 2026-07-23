const { reportBug } = require('../utils/bugReporter');

function globalErrorHandler(err, req, res, next) {
  console.error('[Error]', err.message);
  res.locals.webhookErrorReported = true;
  reportBug({ level: 'error', message: err.message, error: err, context: { method: req.method, path: req.path, body: req.body } });

  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

function notFoundHandler(req, res) {
  res.locals.webhookErrorReported = true;
  reportBug({
    level: 'not_found',
    message: `Ruta no encontrada: ${req.method} ${req.path}`,
    context: { method: req.method, path: req.path, body: req.body }
  });
  res.status(404).json({ error: 'Ruta no encontrada' });
}

module.exports = { globalErrorHandler, notFoundHandler };
