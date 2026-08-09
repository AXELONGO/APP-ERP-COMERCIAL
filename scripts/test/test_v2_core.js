const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { hashPassword, verifyPassword } = require('../../app/auth/passwords');
const { signToken, verifyToken } = require('../../app/auth/tokens');

process.env.ERP_AUTH_SECRET = 'test-secret-with-at-least-32-characters';

const passwordHash = hashPassword('test-password-long-enough');
assert.equal(verifyPassword('test-password-long-enough', passwordHash), true);
assert.equal(verifyPassword('wrong-password', passwordHash), false);

const token = signToken({
  sub: 'user-1',
  workspace_id: 'workspace-1',
  role: 'admin',
  exp: Math.floor(Date.now() / 1000) + 60,
});
assert.equal(verifyToken(token).workspace_id, 'workspace-1');
assert.equal(verifyToken(`${token}invalid`), null);

const schema = fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8');
for (const table of ['workspaces', 'users', 'contacts', 'conversations', 'messages', 'pipeline_stages', 'stage_history', 'appointments', 'audit_events']) {
  assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}

console.log('V2 core tests: OK');
