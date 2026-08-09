const { reportBug } = require('../utils/bugReporter');

function globalErrorHandler(err, req, res, next) {
  console.error('[Error]', err.message);
  res.locals.webhookErrorReported = true;
  reportBug({
    level: 'error',
    message: err.message,
    error: err,
    context: {
      method: req.method,
      path: req.path,
      status: err.status || 500,
      body: req.body,
      source_url: `${req.protocol}://${req.get('host')}${req.originalUrl}`
    }
  });

  res.status(err.status || 500).json({
    error: err.status && err.status < 500 ? (err.message || 'Solicitud inválida') : 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

function notFoundHandler(req, res) {
  res.locals.webhookErrorReported = true;
  reportBug({
    level: 'not_found',
    message: `Ruta no encontrada: ${req.method} ${req.path}`,
    context: { method: req.method, path: req.path, status: 404, body: req.body }
  });
  res.status(404).json({ error: 'Ruta no encontrada' });
}

module.exports = { globalErrorHandler, notFoundHandler };
