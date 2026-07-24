const { seedLegacyPipelines } = require('../../app/services/pipelineService');

seedLegacyPipelines()
  .then(definitions => {
    console.log(`Configuración dinámica lista: ${definitions.length} pipelines.`);
  })
  .catch(error => {
    console.error('No se pudo migrar la configuración de pipelines:', error.message);
    process.exitCode = 1;
  });
