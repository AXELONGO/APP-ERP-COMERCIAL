const CONDITION_OPERATORS = new Set([
  'eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte',
  'exists', 'contains', 'starts_with', 'ends_with'
]);

const STEP_TYPES = new Set(['task', 'approval', 'notification', 'automation', 'custom']);
const ACTION_TYPES = new Set([
  'notify', 'set_field', 'webhook'
]);

function validationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseJson(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function asBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'si', 'sí', 'yes'].includes(String(value).toLowerCase());
}

function normalizeConditions(conditions) {
  const list = Array.isArray(parseJson(conditions, [])) ? parseJson(conditions, []) : [];
  return list.map((condition, index) => {
    const normalized = {
      field: String(condition.field || '').trim(),
      operator: String(condition.operator || 'eq').trim(),
      value: condition.value === undefined ? null : condition.value,
      logic: String(condition.logic || 'and').toLowerCase(),
      order_index: Number.isFinite(Number(condition.order_index)) ? Number(condition.order_index) : index,
      active: asBoolean(condition.active, true)
    };
    if (!normalized.field) throw validationError('Cada condición debe definir field');
    if (!CONDITION_OPERATORS.has(normalized.operator)) {
      throw validationError(`Operador de condición no permitido: ${normalized.operator}`);
    }
    if (!['and', 'or'].includes(normalized.logic)) throw validationError('logic debe ser and u or');
    return normalized;
  });
}

function normalizeActions(actions) {
  const list = Array.isArray(parseJson(actions, [])) ? parseJson(actions, []) : [];
  return list.map(action => {
    const normalized = { ...action, type: String(action.type || '').trim() };
    if (action.script !== undefined || action.code !== undefined || action.javascript !== undefined) {
      throw validationError('No se permite código ejecutable en acciones de pipeline');
    }
    if (!ACTION_TYPES.has(normalized.type)) {
      throw validationError(`Acción no permitida: ${normalized.type || '(vacía)'}`);
    }
    return normalized;
  });
}

function normalizeStep(step, index, stageId) {
  const normalized = {
    step_id: String(step.step_id || step.id || `STEP-${Date.now()}-${index}`),
    stage_id: stageId,
    step_key: String(step.step_key || step.key || `step_${index + 1}`).trim(),
    name: String(step.name || `Paso ${index + 1}`).trim(),
    type: String(step.type || 'task').trim(),
    order_index: Number.isFinite(Number(step.order_index)) ? Number(step.order_index) : index,
    active: asBoolean(step.active, true),
    conditions: normalizeConditions(step.conditions || step.conditions_json),
    actions: normalizeActions(step.actions || step.actions_json),
    config: parseJson(step.config || step.config_json, {})
  };
  if (!normalized.step_key || !normalized.name) throw validationError('Cada paso requiere key y name');
  if (!STEP_TYPES.has(normalized.type)) throw validationError(`Tipo de paso no permitido: ${normalized.type}`);
  return normalized;
}

function normalizeStage(stage, index, pipelineId) {
  const stageId = String(stage.stage_id || stage.id || `STG-${Date.now()}-${index}`);
  const normalized = {
    stage_id: stageId,
    pipeline_id: pipelineId,
    stage_key: String(stage.stage_key || stage.key || `stage_${index + 1}`).trim(),
    name: String(stage.name || `Etapa ${index + 1}`).trim(),
    type: String(stage.type || 'stage').trim(),
    order_index: Number.isFinite(Number(stage.order_index)) ? Number(stage.order_index) : index,
    active: asBoolean(stage.active, true),
    is_initial: asBoolean(stage.is_initial, index === 0),
    is_terminal: asBoolean(stage.is_terminal, false),
    color: String(stage.color || '#7c3aed'),
    legacy_value: stage.legacy_value === undefined || stage.legacy_value === null ? '' : String(stage.legacy_value),
    conditions: normalizeConditions(stage.conditions || stage.conditions_json),
    actions: normalizeActions(stage.actions || stage.actions_json),
    steps: Array.isArray(stage.steps) ? stage.steps.map((step, stepIndex) => normalizeStep(step, stepIndex, stageId)) : []
  };
  if (!normalized.stage_key || !normalized.name) throw validationError('Cada etapa requiere key y name');
  return normalized;
}

function validatePipelineDefinition(input, { partial = false } = {}) {
  const pipeline = { ...(input || {}) };
  if (!partial || pipeline.key !== undefined) {
    pipeline.key = String(pipeline.key || '').trim();
    if (!/^[a-z0-9][a-z0-9_-]{1,60}$/.test(pipeline.key)) {
      throw validationError('key debe usar minúsculas, números, guiones o guiones bajos');
    }
  }
  if (!partial || pipeline.name !== undefined) {
    pipeline.name = String(pipeline.name || '').trim();
    if (!pipeline.name) throw validationError('El pipeline requiere name');
  }
  pipeline.entity_type = String(pipeline.entity_type || pipeline.entityType || 'proyectos').trim();
  pipeline.version = Number(pipeline.version || 1);
  pipeline.status = String(pipeline.status || 'draft');
  pipeline.active = asBoolean(pipeline.active, true);

  if (pipeline.stages !== undefined) {
    if (!Array.isArray(pipeline.stages) || pipeline.stages.length === 0) {
      throw validationError('El pipeline debe tener al menos una etapa');
    }
    pipeline.stages = pipeline.stages.map((stage, index) => normalizeStage(stage, index, pipeline.pipeline_id || pipeline.id || pipeline.key));
    const stageKeys = new Set();
    const stageIds = new Set();
    const orders = new Set();
    let initialCount = 0;
    pipeline.stages.forEach(stage => {
      if (stageKeys.has(stage.stage_key)) throw validationError(`stage_key duplicada: ${stage.stage_key}`);
      if (stageIds.has(stage.stage_id)) throw validationError(`stage_id duplicado: ${stage.stage_id}`);
      if (orders.has(stage.order_index)) throw validationError('order_index duplicado entre etapas');
      stageKeys.add(stage.stage_key);
      stageIds.add(stage.stage_id);
      orders.add(stage.order_index);
      if (stage.active && stage.is_initial) initialCount += 1;
      const stepKeys = new Set();
      stage.steps.forEach(step => {
        if (stepKeys.has(step.step_key)) throw validationError(`step_key duplicada: ${step.step_key}`);
        stepKeys.add(step.step_key);
      });
    });
    if (initialCount !== 1) throw validationError('Debe existir exactamente una etapa inicial activa');

    if (pipeline.transitions !== undefined) {
      if (!Array.isArray(pipeline.transitions)) throw validationError('transitions debe ser un array');
      const transitionIds = new Set();
      pipeline.transitions = pipeline.transitions.map((transition, index) => {
        const from = String(transition.from_stage_id || '').trim();
        const to = String(transition.to_stage_id || '').trim();
        if (!stageIds.has(from) || !stageIds.has(to)) throw validationError('Una transición apunta a una etapa inexistente');
        const id = String(transition.transition_id || transition.id || `TR-${from}-${to}`);
        if (transitionIds.has(id)) throw validationError(`transition_id duplicado: ${id}`);
        transitionIds.add(id);
        return {
          ...transition,
          transition_id: id,
          pipeline_id: pipeline.pipeline_id || pipeline.id || pipeline.key,
          from_stage_id: from,
          to_stage_id: to,
          order_index: Number.isFinite(Number(transition.order_index)) ? Number(transition.order_index) : index,
          active: asBoolean(transition.active, true),
          conditions: normalizeConditions(transition.conditions || transition.conditions_json),
          actions: normalizeActions(transition.actions || transition.actions_json)
        };
      });
    }
  }

  return pipeline;
}

module.exports = {
  ACTION_TYPES: [...ACTION_TYPES],
  CONDITION_OPERATORS: [...CONDITION_OPERATORS],
  STEP_TYPES: [...STEP_TYPES],
  parseJson,
  asBoolean,
  normalizeConditions,
  normalizeActions,
  validatePipelineDefinition,
  validationError
};
