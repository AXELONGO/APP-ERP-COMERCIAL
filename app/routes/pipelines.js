const asyncHandler = require('../middleware/asyncHandler');
const {
  listPipelines,
  getPipeline,
  savePipeline,
  updatePipeline,
  archivePipeline,
  publishPipeline,
  rollbackPipeline,
  transitionRecord,
  removeStage,
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
    const definition = validatePipelineDefinition({ ...req.body, status: req.body.status || 'draft' });
    res.status(201).json(await savePipeline(definition, { actor: actorFromRequest(req), source: 'api_create' }));
  }));

  app.put('/api/pipelines/:pipelineId', asyncHandler(async (req, res) => {
    res.json(await updatePipeline(req.params.pipelineId, req.body, { actor: actorFromRequest(req), source: 'api_update' }));
  }));

  app.delete('/api/pipelines/:pipelineId', asyncHandler(async (req, res) => {
    res.json(await archivePipeline(req.params.pipelineId, { actor: actorFromRequest(req), source: 'api_archive' }));
  }));

  app.post('/api/pipelines/:pipelineId/publish', asyncHandler(async (req, res) => {
    res.json(await publishPipeline(req.params.pipelineId, { actor: actorFromRequest(req) }));
  }));

  app.post('/api/pipelines/:pipelineId/rollback/:version', asyncHandler(async (req, res) => {
    res.json(await rollbackPipeline(req.params.pipelineId, req.params.version, { actor: actorFromRequest(req) }));
  }));

  app.post('/api/pipelines/:pipelineId/stages', asyncHandler(async (req, res) => {
    const current = await getPipeline(req.params.pipelineId);
    const stage = { ...req.body, stage_id: req.body.stage_id || `STG-${Date.now()}` };
    res.status(201).json(await updatePipeline(req.params.pipelineId, { stages: [...current.stages, stage] }, { actor: actorFromRequest(req), source: 'stage_create' }));
  }));

  app.post('/api/pipelines/:pipelineId/stages/reorder', asyncHandler(async (req, res) => {
    const order = Array.isArray(req.body.stage_ids) ? req.body.stage_ids : [];
    const current = await getPipeline(req.params.pipelineId);
    if (order.length !== current.stages.length || new Set(order).size !== order.length) return res.status(400).json({ error: 'stage_ids debe contener todas las etapas una sola vez' });
    const stages = current.stages.map(stage => ({ ...stage, order_index: order.indexOf(stage.stage_id) }));
    if (stages.some(stage => stage.order_index < 0)) return res.status(400).json({ error: 'stage_ids contiene una etapa desconocida' });
    res.json(await updatePipeline(req.params.pipelineId, { stages }, { actor: actorFromRequest(req), source: 'stage_reorder' }));
  }));

  app.put('/api/pipelines/:pipelineId/stages/:stageId', asyncHandler(async (req, res) => {
    const current = await getPipeline(req.params.pipelineId);
    const stages = current.stages.map(stage => stage.stage_id === req.params.stageId ? { ...stage, ...req.body, stage_id: stage.stage_id } : stage);
    if (!stages.some(stage => stage.stage_id === req.params.stageId)) return res.status(404).json({ error: 'Etapa no encontrada' });
    res.json(await updatePipeline(req.params.pipelineId, { stages }, { actor: actorFromRequest(req), source: 'stage_update' }));
  }));

  app.delete('/api/pipelines/:pipelineId/stages/:stageId', asyncHandler(async (req, res) => {
    res.json(await removeStage(req.params.pipelineId, req.params.stageId, { successorStageId: req.body?.successor_stage_id || req.query.successor_stage_id || null, actor: actorFromRequest(req), source: 'stage_delete' }));
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
