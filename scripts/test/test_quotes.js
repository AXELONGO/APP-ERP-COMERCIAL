const assert = require('assert');
const { calculateQuote, validatePaymentPlan } = require('../../app/routes/quotes');

const quote = calculateQuote({
  items: [{ name: 'Servicio', quantity: 2, unit_price: 100 }],
  discount_type: 'percentage',
  discount_value: 10,
  tax_rate: 16,
});

assert.strictEqual(quote.subtotal, 200);
assert.strictEqual(quote.discount_amount, 20);
assert.strictEqual(quote.tax_amount, 28.8);
assert.strictEqual(quote.total, 208.8);
assert.strictEqual(validatePaymentPlan({ concepts: [{ name: 'Pago único', amount: 208.8 }] }, 208.8, true).complete, true);
assert.throws(() => validatePaymentPlan({ concepts: [{ name: 'Anticipo', amount: 100 }] }, 208.8, true), /diferencia/i);
assert.throws(() => calculateQuote({ items: [{ name: 'Inválido', quantity: 0, unit_price: 100 }] }), /cantidad/i);
assert.throws(() => calculateQuote({ items: [{ name: 'Inválido', quantity: 1, unit_price: -1 }] }), /precio/i);

console.log('Quote calculation tests: OK');
