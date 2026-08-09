const crypto = require('crypto');

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

function hashPassword(password) {
  if (!password || password.length < 4) {
    throw new Error('La contraseña debe tener al menos 4 caracteres');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  const [, salt, expectedHex] = String(storedHash || '').split('$');
  if (!salt || !expectedHex) return false;

  const actual = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword };
