const cluster = require('cluster');
const os = require('os');
const env = require('./src/config/env');

if (env.CLUSTER_ENABLED && cluster.isMaster) {
  const numWorkers = env.CLUSTER_WORKERS || os.cpus().length;
  console.log(`[Cluster] Master PID ${process.pid} iniciando ${numWorkers} workers`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[Cluster] Worker ${worker.process.pid} muerto (${signal || code}). Reiniciando...`);
    cluster.fork();
  });
} else {
  const { reportBug } = require('./src/services/bugReporter');

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    reportBug({ level: 'critical', message: 'Uncaught Exception: ' + err.message, error: err })
      .finally(() => process.exit(1));
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    reportBug({ level: 'critical', message: 'Unhandled Rejection: ' + (reason?.message || reason), error: reason });
  });

  const app = require('./src/app');
  const PORT = env.PORT || process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  const prefix = cluster.isWorker ? `[Worker ${process.pid}]` : '';

  console.log(`[Startup] SPREADSHEET_ID: ${env.SPREADSHEET_ID ? '✓ configurado' : '✗ FALTANTE'}`);
  console.log(`[Startup] GOOGLE_CLIENT_ID: ${env.GOOGLE_CLIENT_ID ? '✓ configurado' : '✗ FALTANTE'}`);
  console.log(`[Startup] JWT_SECRET: ${env.JWT_SECRET && env.JWT_SECRET !== 'fallback_secret_for_dev_only' ? '✓ configurado' : '⚠ usando fallback'}`);
  console.log(`[Startup] GOOGLE_CREDENTIALS: ${env.GOOGLE_CREDENTIALS ? '✓ configurado' : '✗ FALTANTE'}`);
  console.log(`[Startup] NODE_ENV: ${env.NODE_ENV}`);

  const server = app.listen(PORT, HOST, () => console.log(`${prefix} ERP LUMARK → http://${HOST}:${PORT}`));
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}
