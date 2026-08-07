const asyncHandler = require('../middleware/asyncHandler');
const {
  listPipelines,
  savePipeline,
  transitionRecord,
  getState,
  getAudit,
  validateLegacyStageChange
} = require('../services/pipelineService');
const { validatePipelineDefinition } = require('../utils/pipelineValidation');

function actorFromRequest(req) {
  return {
    user_id: req.get('x-user-id') || null,
    user_name: req.get('x-user-name') || null,
    source: req.get('x-source') || 'api'
  };
}

function registerPipelineRoutes(app) {
  app.get('/api/pipelines', asyncHandler(async (req, res) => {
    res.json(await listPipelines());
  }));

  app.get('/api/pipelines/:pipelineId', asyncHandler(async (req, res) => {
    res.json(await getPipeline(req.params.pipelineId));
  }));

  app.post('/api/pipelines', asyncHandler(async (req, res) => {
    const definition = validatePipelineDefinition({ ...req.body, status: 'published', active: true });
    res.status(201).json(await savePipeline(definition, { actor: actorFromRequest(req), source: 'api_create' }));
  }));

  app.put('/api/pipelines/:pipelineId', asyncHandler(async (req, res) => {
    res.status(405).json({ error: 'Los pipelines existentes son de solo lectura. Crea un pipeline nuevo.' });
  }));

  app.delete('/api/pipelines/:pipelineId', asyncHandler(async (req, res) => {
    res.status(405).json({ error: 'Los pipelines existentes no se pueden archivar desde este módulo.' });
  }));

  app.post('/api/pipelines/:pipelineId/publish', asyncHandler(async (req, res) => {
    res.status(405).json({ error: 'Los pipelines se publican automáticamente al crearlos.' });
  }));

  app.post('/api/pipelines/:pipelineId/rollback/:version', asyncHandler(async (req, res) => {
    res.status(405).json({ error: 'El rollback de pipelines existentes está deshabilitado en este configurador.' });
  }));

  app.post('/api/pipelines/:pipelineId/stages', asyncHandler(async (req, res) => {
    res.status(405).json({ error: 'Las etapas se definen al crear un pipeline nuevo.' });
  }));

  app.post('/api/pipelines/:pipelineId/stages/reorder', asyncHandler(async (req, res) => {
    res.status(405).json({ error: 'Las etapas se definen al crear un pipeline nuevo.' });
  }));

  app.put('/api/pipelines/:pipelineId/stages/:stageId', asyncHandler(async (req, res) => {
    res.status(405).json({ error: 'Las etapas de pipelines existentes son de solo lectura.' });
  }));

  app.delete('/api/pipelines/:pipelineId/stages/:stageId', asyncHandler(async (req, res) => {
    res.status(405).json({ error: 'Las etapas de pipelines existentes son de solo lectura.' });
  }));

  app.post('/api/pipelines/:pipelineId/transition', asyncHandler(async (req, res) => {
    const { record_type: recordType, record_id: recordId, to_stage_id: toStageId, to_step_id: toStepId, expected_state_version: expectedStateVersion } = req.body;
    if (!recordType || !recordId || !toStageId) return res.status(400).json({ error: 'record_type, record_id y to_stage_id son obligatorios' });
    res.json(await transitionRecord({ pipelineKey: req.params.pipelineId, recordType, recordId, toStageId, toStepId, expectedStateVersion, actor: actorFromRequest(req), source: req.get('x-source') || 'api_transition' }));
  }));

  app.get('/api/pipelines/:pipelineId/states/:recordType/:recordId', asyncHandler(async (req, res) => {
    res.json(await getState(req.params.pipelineId, req.params.recordType, req.params.recordId));
  }));

  app.get('/api/pipelines/:pipelineId/audit', asyncHandler(async (req, res) => {
    res.json(await getAudit(req.params.pipelineId));
  }));

  app.get('/api/pipelines/:pipelineId/validate-stage', asyncHandler(async (req, res) => {
    const result = await validateLegacyStageChange({ pipelineKey: req.params.pipelineId, value: req.query.value });
    res.json({ valid: true, stage: result.stage, pipeline_id: result.definition.pipeline_id });
  }));
}

module.exports = { registerPipelineRoutes, actorFromRequest };
