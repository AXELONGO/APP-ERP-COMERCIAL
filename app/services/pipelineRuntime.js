const { validationError } = require('../utils/pipelineValidation');

function getValue(context, path) {
  return String(path || '').split('.').reduce((value, key) => value == null ? undefined : value[key], context);
}

function compare(actual, operator, expected) {
  switch (operator) {
    case 'eq': return String(actual ?? '') === String(expected ?? '');
    case 'neq': return String(actual ?? '') !== String(expected ?? '');
    case 'in': return Array.isArray(expected) && expected.map(String).includes(String(actual));
    case 'not_in': return Array.isArray(expected) && !expected.map(String).includes(String(actual));
    case 'gt': return Number(actual) > Number(expected);
    case 'gte': return Number(actual) >= Number(expected);
    case 'lt': return Number(actual) < Number(expected);
    case 'lte': return Number(actual) <= Number(expected);
    case 'exists': return actual !== undefined && actual !== null && actual !== '';
    case 'contains': return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'starts_with': return String(actual ?? '').startsWith(String(expected ?? ''));
    case 'ends_with': return String(actual ?? '').endsWith(String(expected ?? ''));
    default: return false;
  }
}

function evaluateConditions(conditions, context = {}) {
  const active = (conditions || []).filter(condition => condition.active !== false);
  if (!active.length) return true;
  let result = compare(getValue(context, active[0].field), active[0].operator, active[0].value);
  for (let index = 1; index < active.length; index += 1) {
    const condition = active[index];
    const value = compare(getValue(context, condition.field), condition.operator, condition.value);
    result = condition.logic === 'or' ? result || value : result && value;
  }
  return result;
}

function actionPlan(actions, context = {}) {
  return (actions || []).filter(action => action.active !== false).map(action => {
    if (action.type === 'set_field' && !action.field) throw validationError('set_field requiere field');
    if (action.type === 'notify' && !action.message) throw validationError('notify requiere message');
    return {
      ...action,
      resolved_value: action.value === '$record_id' ? context.record_id : action.value
    };
  });
}

async function executeActions(actions, context, handlers = {}) {
  const plan = actionPlan(actions, context);
  const results = [];
  for (const action of plan) {
    if (action.type === 'set_field' && handlers.setField) {
      await handlers.setField(action.field, action.resolved_value);
      results.push({ type: action.type, status: 'executed' });
    } else if ((action.type === 'notify' || action.type === 'webhook') && handlers.notify) {
      await handlers.notify(action);
      results.push({ type: action.type, status: 'executed' });
    } else {
      results.push({ type: action.type, status: 'planned' });
    }
  }
  return results;
}

module.exports = { getValue, compare, evaluateConditions, actionPlan, executeActions };
