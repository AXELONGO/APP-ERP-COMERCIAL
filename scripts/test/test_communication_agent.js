const assert = require('assert');
const { buildLocalBrief } = require('../../app/services/communicationAgent');

const brief = buildLocalBrief({
  records: [{
    module: 'prospectos',
    data: {
      'Nombre del Contacto': 'Mario Tabuada',
      Etapa: 'En Proceso',
      Asesor: 'Axel',
      Notas: 'Solicitar seguimiento esta semana'
    }
  }]
}, { channel: 'email', tone: 'ejecutivo' });

assert.match(brief.summary, /Mario Tabuada/);
assert.match(brief.summary, /En Proceso/);
assert.ok(brief.key_points.length >= 2);
assert.ok(brief.next_steps.length >= 2);
assert.match(brief.draft, /Mario Tabuada/);

console.log('Communication agent tests: OK');
