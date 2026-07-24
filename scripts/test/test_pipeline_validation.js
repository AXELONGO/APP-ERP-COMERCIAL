const assert = require('assert');
const {
  validatePipelineDefinition,
  normalizeConditions,
  normalizeActions
} = require('../../app/utils/pipelineValidation');
const { defaultPipelines, rechainTransitions } = require('../../app/services/pipelineService');
const { evaluateConditions, executeActions } = require('../../app/services/pipelineRuntime');

function expectFailure(fn, message) {
  assert.throws(fn, error => error instanceof Error && error.message.includes(message));
}

const defaults = defaultPipelines();
assert.deepStrictEqual(defaults.map(item => item.key), ['proyectos', 'prospectos', 'tareas']);
assert.strictEqual(defaults[0].stages.length, 7);
assert.strictEqual(defaults[1].stages.length, 5);
assert.strictEqual(defaults[2].stages.length, 3);

const valid = validatePipelineDefinition(defaults[0]);
assert.strictEqual(valid.stages.filter(stage => stage.is_initial && stage.active).length, 1);

expectFailure(() => validatePipelineDefinition({ ...valid, key: 'Pipeline inválido' }), 'key debe usar');
expectFailure(() => validatePipelineDefinition({ ...valid, stages: valid.stages.map(stage => ({ ...stage, stage_key: 'duplicada' })) }), 'stage_key duplicada');
expectFailure(() => validatePipelineDefinition({ ...valid, transitions: [{ from_stage_id: 'missing', to_stage_id: valid.stages[0].stage_id }] }), 'etapa inexistente');
expectFailure(() => normalizeConditions([{ field: 'Estado', operator: 'execute_js', value: true }]), 'Operador');
expectFailure(() => normalizeActions([{ type: 'javascript', code: 'alert(1)' }]), 'código ejecutable');

const shortened = {
  ...valid,
  stages: valid.stages.filter(stage => stage.stage_id !== valid.stages[2].stage_id),
  transitions: valid.transitions.filter(transition => transition.from_stage_id !== valid.stages[2].stage_id && transition.to_stage_id !== valid.stages[2].stage_id)
};
const reconnected = rechainTransitions(shortened);
assert(reconnected.transitions.some(transition => transition.from_stage_id === valid.stages[1].stage_id && transition.to_stage_id === valid.stages[3].stage_id));
const generated = rechainTransitions({ ...valid, transitions: [] });
assert(generated.transitions.some(transition => transition.from_stage_id === valid.stages[0].stage_id && transition.to_stage_id === valid.stages[1].stage_id));

assert.strictEqual(evaluateConditions([{ field: 'Estado', operator: 'eq', value: 'Activo' }], { Estado: 'Activo' }), true);
assert.strictEqual(evaluateConditions([{ field: 'Monto', operator: 'gt', value: 10 }], { Monto: 5 }), false);
executeActions([{ type: 'set_field', field: 'Estado', value: 'Cerrado' }], { record_id: 'PRJ-1' }, {
  setField: async (field, value) => assert.deepStrictEqual([field, value], ['Estado', 'Cerrado'])
}).then(() => console.log('Pipeline runtime tests: OK')).catch(error => { console.error(error); process.exitCode = 1; });

console.log('Pipeline validation tests: OK');
