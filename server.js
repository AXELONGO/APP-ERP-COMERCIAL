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
  const PORT = env.PORT;
  const prefix = cluster.isWorker ? `[Worker ${process.pid}]` : '';

  app.listen(PORT, () => console.log(`${prefix} ERP LUMARK → http://localhost:${PORT}`));
}
