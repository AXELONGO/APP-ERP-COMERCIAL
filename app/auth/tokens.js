const crypto = require('crypto');

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function getSecret() {
  if (!process.env.ERP_AUTH_SECRET || process.env.ERP_AUTH_SECRET.length < 32) {
    throw new Error('ERP_AUTH_SECRET debe tener al menos 32 caracteres');
  }
  return process.env.ERP_AUTH_SECRET;
}

function signToken(payload) {
  const body = encode({ ...payload, iat: Math.floor(Date.now() / 1000) });
  const signature = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const [body, signature] = String(token || '').split('.');
    if (!body || !signature) return null;

    const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;

    const payload = decode(body);
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) { return null; }
}

module.exports = { signToken, verifyToken };
