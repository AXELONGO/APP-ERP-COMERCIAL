const assert = require('assert');
const { phoneFromChatId, chatIdFromPhone } = require('../../app/routes/waha');

assert.equal(phoneFromChatId('5215555555555@c.us'), '+5215555555555');
assert.equal(phoneFromChatId('123@g.us'), '123@g.us');
assert.equal(phoneFromChatId('123@lid'), '123@lid');
assert.equal(chatIdFromPhone('+52 (155) 5555-5555'), '5215555555555@c.us');

console.log('WAHA helper tests: OK');
