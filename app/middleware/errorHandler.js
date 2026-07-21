const { reportBug } = require('../utils/bugReporter');

function globalErrorHandler(err, req, res, next) {
  console.error('[Error]', err.message);
  reportBug({ level: 'error', message: err.message, error: err });

  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

module.exports = { globalErrorHandler, notFoundHandler };