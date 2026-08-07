const {
  getSheets,
  getPublicData,
  findRowById,
  SPREADSHEET_ID
} = require('../config/sheets');
const {
  asBoolean,
  parseJson,
  validatePipelineDefinition,
  validationError
} = require('../utils/pipelineValidation');
const { evaluateConditions, executeActions } = require('./pipelineRuntime');
const { sendInformationEvent } = require('../utils/bugReporter');

const CONFIG_SHEETS = {
  pipelines: 'Pipelines',
  stages: 'Pipeline Etapas',
  steps: 'Pipeline Pasos',
  transitions: 'Pipeline Transiciones',
  conditions: 'Pipeline Condiciones',
  states: 'Pipeline Estados',
  versions: 'Pipeline Versiones',
  audit: 'Pipeline Auditoria'
};
const transitionLocks = new Map();

const HEADERS = {
  pipelines: ['pipeline_id', 'key', 'name', 'entity_type', 'version', 'status', 'active', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  stages: ['stage_id', 'pipeline_id', 'stage_key', 'name', 'type', 'order_index', 'active', 'is_initial', 'is_terminal', 'color', 'legacy_value', 'conditions_json', 'actions_json', 'version'],
  steps: ['step_id', 'stage_id', 'step_key', 'name', 'type', 'order_index', 'active', 'conditions_json', 'actions_json', 'config_json'],
  transitions: ['transition_id', 'pipeline_id', 'from_stage_id', 'to_stage_id', 'event_key', 'order_index', 'active', 'conditions_json', 'actions_json'],
  conditions: ['condition_id', 'pipeline_id', 'target_type', 'target_id', 'field', 'operator', 'value_json', 'logic', 'order_index', 'active'],
  states: ['state_id', 'pipeline_id', 'record_type', 'record_id', 'stage_id', 'step_id', 'pipeline_version', 'state_version', 'entered_at', 'updated_at', 'updated_by'],
  versions: ['version_id', 'pipeline_id', 'version', 'status', 'created_at', 'created_by', 'snapshot_json'],
  audit: ['audit_id', 'pipeline_id', 'target_type', 'target_id', 'change_type', 'changed_at', 'changed_by', 'source', 'diff_json', 'previous_version', 'new_version']
};

const LEGACY_MAP = {
  proyectos: { sheet: 'Proyectos', field: 'Etapa actual', entityType: 'proyectos', name: 'Pipeline de proyectos', stages: [
    ['1', 'Activación', 'activacion'], ['2', 'Diagnóstico', 'diagnostico'], ['3', 'Calendario de Contenido', 'calendario_contenido'],
    ['4', 'Creación de Contenido', 'creacion_contenido'], ['5', 'Campaña', 'campana'], ['6', 'Reporte de Resultados', 'reporte_resultados'], ['7', 'Renovación', 'renovacion']
  ] },
  prospectos: { sheet: 'Prospectos', field: 'Etapa', entityType: 'prospectos', name: 'Pipeline de prospectos', stages: [
    ['Nuevo', 'Nuevo', 'nuevo'], ['En Proceso', 'En Proceso', 'en_proceso'], ['Cerrado', 'Cerrado', 'cerrado'], ['Perdido', 'Perdido', 'perdido'], ['Convertido', 'Convertido', 'convertido']
  ] },
  tareas: { sheet: 'Tareas', field: 'Estado', entityType: 'tareas', name: 'Pipeline de tareas', stages: [
    ['Pendiente', 'Pendiente', 'pendiente'], ['En Proceso', 'En Proceso', 'en_proceso'], ['Terminado', 'Terminado', 'terminado']
  ] }
};

function now() { return new Date().toISOString(); }

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function actorName(actor) {
  if (!actor) return 'sistema';
  return actor.user_name || actor.user_id || actor.name || 'sistema';
}

function columnLetter(index) {
  let result = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function stringify(value) {
  if (value === undefined || value === null) return '';
  return Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function basePipeline(key) {
  const legacy = LEGACY_MAP[key];
  const pipelineId = `PIPE-${key.toUpperCase()}`;
  const timestamp = now();
  const stages = legacy.stages.map(([legacyValue, name, stageKey], index) => ({
    stage_id: `STG-${key.toUpperCase()}-${index + 1}`,
    pipeline_id: pipelineId,
    stage_key: stageKey,
    name,
    type: 'stage',
    order_index: index,
    active: true,
    is_initial: index === 0,
    is_terminal: index === legacy.stages.length - 1,
    color: ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#9333ea'][index % 7],
    legacy_value: legacyValue,
    conditions: [],
    actions: [],
    steps: []
  }));
  const transitions = [];
  stages.forEach(from => stages.forEach(to => {
    if (from.stage_id !== to.stage_id) {
      transitions.push({
        transition_id: `TR-${from.stage_id}-${to.stage_id}`,
        pipeline_id: pipelineId,
        from_stage_id: from.stage_id,
        to_stage_id: to.stage_id,
        event_key: 'stage_changed',
        order_index: transitions.length,
        active: true,
        conditions: [],
        actions: []
      });
    }
  }));
  return {
    pipeline_id: pipelineId,
    key,
    name: legacy.name,
    entity_type: legacy.entityType,
    version: 1,
    status: 'published',
    active: true,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: 'migration',
    updated_by: 'migration',
    stages,
    transitions
  };
}

function defaultPipelines() {
  return Object.keys(LEGACY_MAP).map(basePipeline);
}

async function ensurePipelineSheets(sheets) {
  const response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = new Set((response.data.sheets || []).map(sheet => sheet.properties.title));
  const missing = Object.values(CONFIG_SHEETS).filter(name => !existing.has(name));
  if (missing.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: missing.map(title => ({ addSheet: { properties: { title } } })) }
    });
  }
  for (const [key, title] of Object.entries(CONFIG_SHEETS)) {
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${title}'!A1:A1` }).catch(() => ({ data: {} }));
    if (!result.data.values?.[0]?.[0]) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${title}'!A1:${columnLetter(HEADERS[key].length - 1)}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS[key]] }
      });
    }
  }
}

async function readRows(sheets, sheetName, { allowMissing = false } = {}) {
  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${sheetName}'!A:Z` });
    const values = response.data.values || [];
    if (!values.length) return [];
    const headers = values[0].map(value => String(value || '').trim());
    return values.slice(1).map((row, index) => {
      const item = { _rowIndex: index + 2 };
      headers.forEach((header, column) => { if (header) item[header] = row[column] ?? ''; });
      return item;
    }).filter(row => Object.keys(row).length > 1);
  } catch (error) {
    if (allowMissing) return [];
    throw error;
  }
}

async function readSnapshot(sheets) {
  const snapshot = {};
  for (const [key, title] of Object.entries(CONFIG_SHEETS)) snapshot[key] = await readRows(sheets, title);
  return snapshot;
}

function rowConditions(snapshot, targetType, targetId) {
  return (snapshot.conditions || [])
    .filter(row => row.target_type === targetType && row.target_id === targetId && asBoolean(row.active, true))
    .sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0))
    .map(row => ({ field: row.field, operator: row.operator, value: parseJson(row.value_json, row.value_json), logic: row.logic || 'and', order_index: Number(row.order_index || 0), active: asBoolean(row.active, true) }));
}

function hydratePipeline(row, snapshot) {
  const pipelineId = row.pipeline_id;
  const stageRows = (snapshot.stages || []).filter(stage => stage.pipeline_id === pipelineId);
  const stepRows = snapshot.steps || [];
  const stages = stageRows.map(stage => {
    const stageId = stage.stage_id;
    const steps = stepRows.filter(step => step.stage_id === stageId).sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0)).map(step => ({
      step_id: step.step_id,
      stage_id: stageId,
      step_key: step.step_key,
      name: step.name,
      type: step.type || 'task',
      order_index: Number(step.order_index || 0),
      active: asBoolean(step.active, true),
      conditions: parseJson(step.conditions_json, rowConditions(snapshot, 'step', step.step_id)),
      actions: parseJson(step.actions_json, []),
      config: parseJson(step.config_json, {})
    }));
    return {
      stage_id: stageId,
      pipeline_id: pipelineId,
      stage_key: stage.stage_key,
      name: stage.name,
      type: stage.type || 'stage',
      order_index: Number(stage.order_index || 0),
      active: asBoolean(stage.active, true),
      is_initial: asBoolean(stage.is_initial, false),
      is_terminal: asBoolean(stage.is_terminal, false),
      color: stage.color || '#7c3aed',
      legacy_value: stage.legacy_value || '',
      conditions: parseJson(stage.conditions_json, rowConditions(snapshot, 'stage', stageId)),
      actions: parseJson(stage.actions_json, []),
      steps
    };
  }).sort((a, b) => a.order_index - b.order_index);
  const transitions = (snapshot.transitions || []).filter(transition => transition.pipeline_id === pipelineId).map(transition => ({
    transition_id: transition.transition_id,
    pipeline_id: pipelineId,
    from_stage_id: transition.from_stage_id,
    to_stage_id: transition.to_stage_id,
    event_key: transition.event_key || 'stage_changed',
    order_index: Number(transition.order_index || 0),
    active: asBoolean(transition.active, true),
    conditions: parseJson(transition.conditions_json, rowConditions(snapshot, 'transition', transition.transition_id)),
    actions: parseJson(transition.actions_json, [])
  }));
  return {
    pipeline_id: pipelineId,
    key: row.key,
    name: row.name,
    entity_type: row.entity_type,
    version: Number(row.version || 1),
    status: row.status || 'draft',
    active: asBoolean(row.active, true),
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
    created_by: row.created_by || '',
    updated_by: row.updated_by || '',
    stages,
    transitions
  };
}

function definitionsFromSnapshot(snapshot) {
  return (snapshot.pipelines || []).map(row => hydratePipeline(row, snapshot));
}

function mergeDefaults(definitions) {
  const byKey = new Map(definitions.map(definition => [definition.key, definition]));
  defaultPipelines().forEach(definition => {
    if (!byKey.has(definition.key)) byKey.set(definition.key, definition);
  });
  return [...byKey.values()];
}

async function listPipelines() {
  try {
    const sheets = await getSheets();
    return mergeDefaults(definitionsFromSnapshot(await readSnapshot(sheets)));
  } catch (_) {
    return defaultPipelines().map(definition => ({ ...definition, source: 'legacy_fallback' }));
  }
}

async function getPipeline(reference) {
  const definitions = await listPipelines();
  const pipeline = definitions.find(item => item.pipeline_id === reference || item.key === reference);
  if (!pipeline) throw validationError(`Pipeline no encontrado: ${reference}`, 404);
  return pipeline;
}

function rechainTransitions(definition) {
  const activeStages = definition.stages.filter(stage => stage.active).sort((a, b) => a.order_index - b.order_index);
  const validIds = new Set(activeStages.map(stage => stage.stage_id));
  const transitions = (definition.transitions || []).filter(item => item.active !== false && validIds.has(item.from_stage_id) && validIds.has(item.to_stage_id));
  const preservedTransitions = (definition.transitions || []).filter(item => item.active === false && validIds.has(item.from_stage_id) && validIds.has(item.to_stage_id));
  const pairs = new Set([...transitions, ...preservedTransitions].map(item => `${item.from_stage_id}->${item.to_stage_id}`));
  for (let index = 0; index < activeStages.length - 1; index += 1) {
    const from = activeStages[index];
    const to = activeStages[index + 1];
    const pair = `${from.stage_id}->${to.stage_id}`;
    if (!pairs.has(pair)) {
      transitions.push({ transition_id: `TR-${from.stage_id}-${to.stage_id}`, pipeline_id: definition.pipeline_id, from_stage_id: from.stage_id, to_stage_id: to.stage_id, event_key: 'stage_changed', order_index: transitions.length, active: true, conditions: [], actions: [] });
    }
  }
  return { ...definition, transitions: [...transitions, ...preservedTransitions] };
}

function pipelineRow(definition) {
  return [definition.pipeline_id, definition.key, definition.name, definition.entity_type, definition.version, definition.status, definition.active, definition.created_at, definition.updated_at, definition.created_by, definition.updated_by];
}

function stageRow(stage, version) {
  return [stage.stage_id, stage.pipeline_id, stage.stage_key, stage.name, stage.type, stage.order_index, stage.active, stage.is_initial, stage.is_terminal, stage.color, stage.legacy_value, stringify(stage.conditions), stringify(stage.actions), version];
}

function stepRow(step) {
  return [step.step_id, step.stage_id, step.step_key, step.name, step.type, step.order_index, step.active, stringify(step.conditions), stringify(step.actions), stringify(step.config)];
}

function transitionRow(transition) {
  return [transition.transition_id, transition.pipeline_id, transition.from_stage_id, transition.to_stage_id, transition.event_key, transition.order_index, transition.active, stringify(transition.conditions), stringify(transition.actions)];
}

function conditionRows(definition) {
  const rows = [];
  const add = (targetType, targetId, conditions) => (conditions || []).forEach((condition, index) => rows.push([
    `COND-${targetId}-${index + 1}`, definition.pipeline_id, targetType, targetId, condition.field, condition.operator,
    stringify(condition.value), condition.logic || 'and', condition.order_index ?? index, condition.active !== false
  ]));
  definition.stages.forEach(stage => {
    add('stage', stage.stage_id, stage.conditions);
    stage.steps.forEach(step => add('step', step.step_id, step.conditions));
  });
  definition.transitions.forEach(transition => add('transition', transition.transition_id, transition.conditions));
  return rows;
}

function auditRow({ pipelineId, targetType, targetId, changeType, actor, source, diff, previousVersion, newVersion }) {
  return [newId('AUD'), pipelineId, targetType, targetId, changeType, now(), actorName(actor), source || 'api', JSON.stringify(diff || {}), previousVersion || '', newVersion || ''];
}

function versionRow(definition, actor) {
  return [newId('VER'), definition.pipeline_id, definition.version, definition.status, now(), actorName(actor), JSON.stringify(definition)];
}

async function replaceSheet(sheets, key, rows) {
  const title = CONFIG_SHEETS[key];
  const values = [HEADERS[key], ...rows];
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `'${title}'!A:Z`, requestBody: {} });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${title}'!A1:${columnLetter(HEADERS[key].length - 1)}${values.length}`,
    valueInputOption: 'RAW',
    requestBody: { values }
  });
}

async function persistDefinitions(sheets, definitions, audits = [], versions = []) {
  const rows = { pipelines: [], stages: [], steps: [], transitions: [], conditions: [], states: [], versions: [], audit: [] };
  definitions.forEach(definition => {
    rows.pipelines.push(pipelineRow(definition));
    definition.stages.forEach(stage => {
      rows.stages.push(stageRow(stage, definition.version));
      stage.steps.forEach(step => rows.steps.push(stepRow(step)));
    });
    definition.transitions.forEach(transition => rows.transitions.push(transitionRow(transition)));
    rows.conditions.push(...conditionRows(definition));
  });
  const snapshot = await readSnapshot(sheets);
  rows.states = (snapshot.states || []).map(row => HEADERS.states.map(header => row[header] ?? ''));
  rows.versions = (snapshot.versions || []).map(row => HEADERS.versions.map(header => row[header] ?? '')).concat(versions);
  rows.audit = (snapshot.audit || []).map(row => HEADERS.audit.map(header => row[header] ?? '')).concat(audits);
  for (const key of Object.keys(HEADERS)) await replaceSheet(sheets, key, rows[key]);
}

async function reassignRemovedStages(sheets, previous, next, actor, source) {
  if (!previous) return;
  const activeNext = next.stages.filter(stage => stage.active).sort((a, b) => a.order_index - b.order_index);
  const nextIds = new Set(next.stages.map(stage => stage.stage_id));
  const removed = previous.stages.filter(stage => !nextIds.has(stage.stage_id));
  if (!removed.length || !activeNext.length) return;
  const states = await readRows(sheets, CONFIG_SHEETS.states);
  const mapping = LEGACY_MAP[next.entity_type];
  const legacyRows = mapping ? await getPublicData(mapping.sheet).catch(() => []) : [];
  const idFieldForRow = row => Object.keys(row).find(key => /^ID /.test(key));
  for (const stage of removed) {
    const successor = activeNext.find(item => item.order_index > stage.order_index) || activeNext[activeNext.length - 1];
    const affected = states.filter(state => state.pipeline_id === previous.pipeline_id && state.stage_id === stage.stage_id);
    for (const state of affected) {
      await updateLegacyField(sheets, state.record_type, state.record_id, successor.legacy_value || successor.stage_key);
      const updated = { ...state, stage_id: successor.stage_id, state_version: Number(state.state_version || 0) + 1, updated_at: now(), updated_by: actorName(actor) };
      await saveState(sheets, updated);
      await saveAudit(sheets, { pipelineId: previous.pipeline_id, targetType: 'state', targetId: state.record_id, changeType: 'stage_removed_reassigned', actor, source, diff: { from_stage_id: stage.stage_id, to_stage_id: successor.stage_id }, previousVersion: state.state_version, newVersion: updated.state_version });
    }
    const affectedIds = new Set(affected.map(state => state.record_id));
    for (const row of legacyRows.filter(item => item[mapping.field] === stage.legacy_value)) {
      const idField = idFieldForRow(row);
      const recordId = idField ? row[idField] : null;
      if (!recordId || affectedIds.has(recordId)) continue;
      await updateLegacyField(sheets, next.entity_type, recordId, successor.legacy_value || successor.stage_key);
      const updated = { state_id: newId('STATE'), pipeline_id: previous.pipeline_id, record_type: next.entity_type, record_id: recordId, stage_id: successor.stage_id, step_id: null, pipeline_version: next.version, state_version: 1, entered_at: now(), updated_at: now(), updated_by: actorName(actor) };
      await saveState(sheets, updated);
      await saveAudit(sheets, { pipelineId: previous.pipeline_id, targetType: 'state', targetId: recordId, changeType: 'stage_removed_reassigned', actor, source, diff: { from_stage_id: stage.stage_id, to_stage_id: successor.stage_id }, previousVersion: 0, newVersion: 1 });
    }
  }
}

async function seedLegacyPipelines() {
  const sheets = await getSheets();
  await ensurePipelineSheets(sheets);
  const snapshot = await readSnapshot(sheets);
  const current = definitionsFromSnapshot(snapshot);
  const existingKeys = new Set(current.map(item => item.key));
  const repairedCurrent = current.map(definition => {
    if (LEGACY_MAP[definition.key] && definition.status === 'published' && definition.active && !definition.transitions.length) return rechainTransitions(definition);
    return definition;
  });
  const definitions = [...repairedCurrent];
  const audits = [];
  const versions = [];
  const missing = defaultPipelines().filter(definition => !existingKeys.has(definition.key));
  repairedCurrent.forEach((definition, index) => {
    if (JSON.stringify(definition.transitions) !== JSON.stringify(current[index].transitions)) {
      audits.push(auditRow({ pipelineId: definition.pipeline_id, targetType: 'pipeline', targetId: definition.pipeline_id, changeType: 'repair_transitions', actor: { user_name: 'migration' }, source: 'migration', diff: { previous: current[index].transitions, repaired: definition.transitions }, previousVersion: definition.version, newVersion: definition.version }));
      versions.push(versionRow(definition, { user_name: 'migration' }));
    }
  });
  if (!missing.length && !audits.length) return current;
  missing.forEach(definition => {
    definitions.push(definition);
    audits.push(auditRow({ pipelineId: definition.pipeline_id, targetType: 'pipeline', targetId: definition.pipeline_id, changeType: 'seed_legacy', actor: { user_name: 'migration' }, source: 'migration', diff: { created: definition.key }, newVersion: 1 }));
    versions.push(versionRow(definition, { user_name: 'migration' }));
  });
  await persistDefinitions(sheets, definitions, audits, versions);
  return definitions;
}

async function savePipeline(input, { reference = null, actor = null, source = 'api' } = {}) {
  const sheets = await getSheets();
  await ensurePipelineSheets(sheets);
  const snapshot = await readSnapshot(sheets);
  const currentDefinitions = definitionsFromSnapshot(snapshot);
  const fallbackDefinitions = currentDefinitions.length ? currentDefinitions : defaultPipelines();
  const existing = reference ? fallbackDefinitions.find(item => item.pipeline_id === reference || item.key === reference) : null;
  const pipelineId = existing?.pipeline_id || input.pipeline_id || input.id || newId('PIPE');
  const definition = rechainTransitions(validatePipelineDefinition({
    ...(existing || {}),
    ...input,
    pipeline_id: pipelineId,
    stages: input.stages || existing?.stages || [],
    transitions: input.transitions || existing?.transitions || []
  }));
  const duplicate = fallbackDefinitions.find(item => item.key === definition.key && item.pipeline_id !== pipelineId);
  if (duplicate) throw validationError(`Ya existe un pipeline con key ${definition.key}`, 409);
  const timestamp = now();
  definition.updated_at = timestamp;
  definition.updated_by = actorName(actor);
  definition.created_at = existing?.created_at || timestamp;
  definition.created_by = existing?.created_by || actorName(actor);
  const definitions = fallbackDefinitions.filter(item => item.pipeline_id !== pipelineId).concat(definition);
  const audits = [auditRow({
    pipelineId,
    targetType: 'pipeline',
    targetId: pipelineId,
    changeType: existing ? 'updated' : 'created',
    actor,
    source,
    diff: { before: existing || null, after: definition },
    previousVersion: existing?.version,
    newVersion: definition.version
  })];
  await persistDefinitions(sheets, definitions, audits, [versionRow(definition, actor)]);
  await reassignRemovedStages(sheets, existing, definition, actor, source);
  return definition;
}

async function updatePipeline(reference, patch, options = {}) {
  const current = await getPipeline(reference);
  return savePipeline({ ...current, ...patch, pipeline_id: current.pipeline_id }, { ...options, reference: current.pipeline_id });
}

async function archivePipeline(reference, options = {}) {
  return updatePipeline(reference, { active: false, status: 'archived' }, options);
}

async function publishPipeline(reference, options = {}) {
  const current = await getPipeline(reference);
  const validated = validatePipelineDefinition({ ...current, status: 'published', active: true, version: Number(current.version || 1) + 1 });
  return savePipeline(validated, { ...options, reference: current.pipeline_id, source: options.source || 'publish' });
}

async function rollbackPipeline(reference, version, options = {}) {
  const current = await getPipeline(reference);
  const sheets = await getSheets();
  await ensurePipelineSheets(sheets);
  const versions = await readRows(sheets, CONFIG_SHEETS.versions);
  const selected = versions.filter(row => row.pipeline_id === current.pipeline_id && Number(row.version) === Number(version)).sort((a, b) => Number(a._rowIndex || 0) - Number(b._rowIndex || 0)).pop();
  if (!selected) throw validationError(`Versión no encontrada: ${version}`, 404);
  const snapshot = parseJson(selected.snapshot_json, null);
  if (!snapshot) throw validationError('La versión almacenada no es válida', 500);
  return savePipeline({ ...snapshot, pipeline_id: current.pipeline_id, key: current.key, version: Number(current.version || 1) + 1, status: 'published', active: true }, { ...options, reference: current.pipeline_id, source: options.source || 'rollback' });
}

async function appendRow(sheets, key, row) {
  const title = CONFIG_SHEETS[key];
  await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: `'${title}'!A:${columnLetter(HEADERS[key].length - 1)}`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [row] } });
}

async function updateRow(sheets, key, rowIndex, row) {
  const title = CONFIG_SHEETS[key];
  await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `'${title}'!A${rowIndex}:${columnLetter(HEADERS[key].length - 1)}${rowIndex}`, valueInputOption: 'RAW', requestBody: { values: [row] } });
}

async function saveState(sheets, state) {
  await ensurePipelineSheets(sheets);
  const rows = await readRows(sheets, CONFIG_SHEETS.states);
  const existing = rows.find(row => row.state_id === state.state_id || (row.pipeline_id === state.pipeline_id && row.record_type === state.record_type && row.record_id === state.record_id));
  const row = HEADERS.states.map(header => state[header] ?? '');
  if (existing) await updateRow(sheets, 'states', existing._rowIndex, row);
  else await appendRow(sheets, 'states', row);
}

async function saveAudit(sheets, entry) {
  await ensurePipelineSheets(sheets);
  await appendRow(sheets, 'audit', auditRow(entry));
}

async function legacyValue(recordType, recordId) {
  const mapping = LEGACY_MAP[recordType];
  if (!mapping) return null;
  const rows = await getPublicData(mapping.sheet).catch(() => []);
  const row = rows.find(item => Object.values(item).includes(recordId));
  return row ? row[mapping.field] || null : null;
}

async function legacyRecord(recordType, recordId) {
  const mapping = LEGACY_MAP[recordType];
  if (!mapping) return {};
  const rows = await getPublicData(mapping.sheet).catch(() => []);
  return rows.find(item => Object.values(item).includes(recordId)) || {};
}

function stageForLegacy(definition, value) {
  const normalized = String(value ?? '');
  return definition.stages.find(stage => stage.legacy_value === normalized || stage.stage_key === normalized || stage.name === normalized);
}

async function currentState(sheets, definition, recordType, recordId) {
  const rows = await readRows(sheets, CONFIG_SHEETS.states);
  const existing = rows.find(row => row.pipeline_id === definition.pipeline_id && row.record_type === recordType && row.record_id === recordId);
  if (existing) return { ...existing, state_version: Number(existing.state_version || 0), pipeline_version: Number(existing.pipeline_version || definition.version) };
  const legacy = await legacyValue(recordType, recordId);
  const stage = stageForLegacy(definition, legacy) || definition.stages.find(item => item.is_initial && item.active) || definition.stages.find(item => item.active);
  return { state_id: newId('STATE'), pipeline_id: definition.pipeline_id, record_type: recordType, record_id: recordId, stage_id: stage?.stage_id || null, step_id: null, pipeline_version: definition.version, state_version: 0, entered_at: now(), updated_at: now(), updated_by: 'legacy' };
}

async function validateLegacyStageChange({ pipelineKey, value }) {
  const definition = await getPipeline(pipelineKey);
  const stage = stageForLegacy(definition, value);
  if (!stage) throw validationError(`Etapa no válida para ${pipelineKey}: ${value}`);
  if (!stage.active) throw validationError(`La etapa ${stage.name} está inactiva`);
  return { definition, stage };
}

async function recordLegacyStageChange({ pipelineKey, recordType, recordId, value, actor = null }) {
  const { definition, stage } = await validateLegacyStageChange({ pipelineKey, value });
  if (definition.entity_type !== recordType) throw validationError(`El pipeline ${definition.key} no acepta registros de tipo ${recordType}`, 422);
  const sheets = await getSheets();
  await ensurePipelineSheets(sheets);
  const previous = await currentState(sheets, definition, recordType, recordId);
  const timestamp = now();
  const state = {
    ...previous,
    state_id: previous.state_id || newId('STATE'),
    stage_id: stage.stage_id,
    pipeline_version: definition.version,
    state_version: Number(previous.state_version || 0) + 1,
    entered_at: previous.stage_id === stage.stage_id ? previous.entered_at : timestamp,
    updated_at: timestamp,
    updated_by: actorName(actor)
  };
  await saveState(sheets, state);
  if (previous.stage_id !== stage.stage_id) {
    await saveAudit(sheets, { pipelineId: definition.pipeline_id, targetType: 'state', targetId: recordId, changeType: 'legacy_stage_changed', actor, source: 'legacy_crud', diff: { from_stage_id: previous.stage_id, to_stage_id: stage.stage_id, value }, previousVersion: previous.state_version, newVersion: state.state_version });
  }
  return state;
}

async function updateLegacyField(sheets, recordType, recordId, value) {
  const mapping = LEGACY_MAP[recordType];
  if (!mapping) throw validationError(`record_type no soportado: ${recordType}`);
  const rowNumber = await findRowById(sheets, mapping.sheet, recordId);
  if (rowNumber === -1) throw validationError(`Registro no encontrado: ${recordId}`, 404);
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${mapping.sheet}'!A1:Z1` });
  const headers = result.data.values?.[0] || [];
  const index = headers.findIndex(header => header === mapping.field);
  if (index === -1) throw validationError(`No existe la columna ${mapping.field} en ${mapping.sheet}`, 500);
  await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `'${mapping.sheet}'!${columnLetter(index)}${rowNumber}`, valueInputOption: 'RAW', requestBody: { values: [[value]] } });
}

async function updateRecordField(sheets, recordType, recordId, field, value) {
  const mapping = LEGACY_MAP[recordType];
  if (!mapping || /^id\b/i.test(String(field))) throw validationError(`Campo no permitido para acción: ${field}`);
  const rowNumber = await findRowById(sheets, mapping.sheet, recordId);
  if (rowNumber === -1) throw validationError(`Registro no encontrado: ${recordId}`, 404);
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${mapping.sheet}'!A1:Z1` });
  const headers = result.data.values?.[0] || [];
  const index = headers.findIndex(header => header === field);
  if (index === -1) throw validationError(`No existe el campo ${field} en ${mapping.sheet}`, 400);
  await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `'${mapping.sheet}'!${columnLetter(index)}${rowNumber}`, valueInputOption: 'RAW', requestBody: { values: [[value ?? '']] } });
}

async function transitionRecordUnsafe({ pipelineKey, recordType, recordId, toStageId, toStepId = null, actor = null, source = 'api', expectedStateVersion = null }) {
  const definition = rechainTransitions(await getPipeline(pipelineKey));
  if (definition.entity_type !== recordType) throw validationError(`El pipeline ${definition.key} no acepta registros de tipo ${recordType}`, 422);
  if (!definition.active || definition.status !== 'published') throw validationError('El pipeline no está publicado y activo', 409);
  const target = definition.stages.find(stage => stage.stage_id === toStageId && stage.active);
  if (!target) throw validationError('La etapa destino no existe o está inactiva');
  const targetStep = toStepId ? target.steps.find(step => step.step_id === toStepId && step.active) : target.steps.find(step => step.active);
  if (toStepId && !targetStep) throw validationError('El paso destino no existe o está inactivo');
  const nextStepId = targetStep?.step_id || null;
  const sheets = await getSheets();
  await ensurePipelineSheets(sheets);
  const previous = await currentState(sheets, definition, recordType, recordId);
  const existingRecord = await legacyRecord(recordType, recordId);
  if (!Object.keys(existingRecord).length) throw validationError(`Registro no encontrado: ${recordId}`, 404);
  if (expectedStateVersion !== null && Number(expectedStateVersion) !== Number(previous.state_version)) throw validationError('El estado cambió; recarga el registro antes de moverlo', 409);
  let actionResults = [];
  const stageChanged = previous.stage_id !== target.stage_id;
  const stepChanged = previous.step_id !== nextStepId;
  if (stageChanged || stepChanged) {
    const transition = definition.transitions.find(item => item.active !== false && item.from_stage_id === previous.stage_id && item.to_stage_id === target.stage_id);
    if (stageChanged && !transition) throw validationError('La transición solicitada no está permitida', 422);
    const context = { ...existingRecord, record_id: recordId, record_type: recordType, from_stage_id: previous.stage_id, to_stage_id: target.stage_id, stage_id: previous.stage_id, step_id: nextStepId };
    if (stageChanged && !evaluateConditions(transition.conditions, context)) throw validationError('Las condiciones de la transición no se cumplen', 422);
    if (!evaluateConditions(target.conditions, context) || !evaluateConditions(targetStep?.conditions, context)) throw validationError('Las condiciones de la etapa no se cumplen', 422);
    const actions = [...(stageChanged ? (transition.actions || []) : []), ...(stageChanged ? (target.actions || []) : []), ...(targetStep?.actions || [])];
    actionResults = await executeActions(actions, context, {
      setField: (field, value) => updateRecordField(sheets, recordType, recordId, field, value),
      notify: action => sendInformationEvent({ category: 'movimiento', module: `pipeline_${definition.key}`, event_type: 'pipeline.action', trigger_source: 'pipeline', record_id: recordId, data: { action, pipeline_id: definition.pipeline_id, stage_id: target.stage_id } })
    });
    context.action_results = actionResults;
  }
  const legacy = target.legacy_value || target.stage_key;
  const previousStage = definition.stages.find(stage => stage.stage_id === previous.stage_id);
  const timestamp = now();
  const state = { ...previous, stage_id: target.stage_id, step_id: nextStepId, pipeline_version: definition.version, state_version: Number(previous.state_version || 0) + 1, entered_at: previous.stage_id === target.stage_id ? previous.entered_at : timestamp, updated_at: timestamp, updated_by: actorName(actor) };
  try {
    await updateLegacyField(sheets, recordType, recordId, legacy);
    await saveState(sheets, state);
  } catch (error) {
    if (previousStage) {
      await updateLegacyField(sheets, recordType, recordId, previousStage.legacy_value || previousStage.stage_key).catch(rollbackError => {
        console.error('[Pipeline] No se pudo restaurar la etapa anterior:', rollbackError.message);
      });
    }
    throw error;
  }
  if (previous.stage_id !== target.stage_id || previous.step_id !== nextStepId) {
    try {
      await saveAudit(sheets, { pipelineId: definition.pipeline_id, targetType: 'state', targetId: recordId, changeType: 'transition', actor, source, diff: { from_stage_id: previous.stage_id, to_stage_id: target.stage_id, from_step_id: previous.step_id, to_step_id: nextStepId }, previousVersion: previous.state_version, newVersion: state.state_version });
    } catch (auditError) {
      console.error('[Pipeline] Estado guardado, pero falló la auditoría:', auditError.message);
      void sendInformationEvent({ category: 'bug', module: 'pipeline', event_type: 'pipeline.audit_failed', record_id: recordId, data: { pipeline_id: definition.pipeline_id, error: auditError.message } });
    }
  }
  return { success: true, persisted: true, state, stage: target, pipeline: definition, actions: actionResults };
}

async function transitionRecord(args) {
  const lockKey = `${args.pipelineKey}:${args.recordType}:${args.recordId}`;
  const previous = transitionLocks.get(lockKey) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  transitionLocks.set(lockKey, current);
  await previous;
  try {
    return await transitionRecordUnsafe(args);
  } finally {
    release();
    if (transitionLocks.get(lockKey) === current) transitionLocks.delete(lockKey);
  }
}

async function removeStage(reference, stageId, { successorStageId = null, actor = null, source = 'api' } = {}) {
  const definition = await getPipeline(reference);
  const stage = definition.stages.find(item => item.stage_id === stageId);
  if (!stage) throw validationError('Etapa no encontrada', 404);
  const successors = definition.stages.filter(item => item.active && item.stage_id !== stageId).sort((a, b) => a.order_index - b.order_index);
  const successor = successors.find(item => item.stage_id === successorStageId) || successors.find(item => item.order_index > stage.order_index) || successors[successors.length - 1];
  if (!successor) throw validationError('No se puede eliminar la única etapa del pipeline');
  if (stage.is_initial && !successorStageId) throw validationError('La etapa inicial requiere successor_stage_id');
  const wasInitial = stage.is_initial;
  const sheets = await getSheets();
  await ensurePipelineSheets(sheets);
  stage.active = false;
  stage.is_initial = false;
  if (wasInitial) successor.is_initial = true;
  const updated = rechainTransitions({ ...definition, stages: definition.stages, transitions: definition.transitions });
  const saved = await savePipeline(updated, { reference: definition.pipeline_id, actor, source });
  await reassignRemovedStages(sheets, definition, { ...saved, stages: saved.stages.filter(item => item.stage_id !== stageId) }, actor, source);
  return saved;
}

async function getState(reference, recordType, recordId) {
  const definition = await getPipeline(reference);
  const sheets = await getSheets();
  await ensurePipelineSheets(sheets);
  const state = await currentState(sheets, definition, recordType, recordId);
  const stage = definition.stages.find(item => item.stage_id === state.stage_id) || null;
  return { ...state, stage, pipeline: definition };
}

async function getAudit(reference) {
  const definition = await getPipeline(reference);
  const sheets = await getSheets();
  await ensurePipelineSheets(sheets);
  const rows = await readRows(sheets, CONFIG_SHEETS.audit);
  return rows.filter(row => row.pipeline_id === definition.pipeline_id).map(row => ({
    ...row,
    diff: parseJson(row.diff_json, {})
  }));
}

module.exports = {
  CONFIG_SHEETS,
  HEADERS,
  LEGACY_MAP,
  defaultPipelines,
  ensurePipelineSheets,
  seedLegacyPipelines,
  listPipelines,
  getPipeline,
  savePipeline,
  updatePipeline,
  archivePipeline,
  publishPipeline,
  rollbackPipeline,
  validateLegacyStageChange,
  recordLegacyStageChange,
  transitionRecord,
  removeStage,
  getState,
  getAudit,
  rechainTransitions
};
