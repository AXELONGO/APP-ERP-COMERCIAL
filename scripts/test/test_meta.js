const assert = require('assert');
const crypto = require('crypto');
const { metaOAuthUrl, verifySignature } = require('../../app/services/metaClient');

const url = metaOAuthUrl({ appId: '123', redirectUri: 'https://example.com/callback', state: 'state' });
assert.equal(new URL(url).searchParams.get('client_id'), '123');
assert.equal(new URL(url).searchParams.get('state'), 'state');

const body = Buffer.from('{"object":"page"}');
const secret = 'meta-secret';
const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
assert.equal(verifySignature(body, signature, secret), true);
assert.equal(verifySignature(body, signature, 'wrong-secret'), false);

console.log('Meta helper tests: OK');
