const fs = require('fs');
const path = require('path');
const { getPool } = require('../config/database');
const { hashPassword } = require('../auth/passwords');

async function ensureV2Bootstrap() {
  if (!process.env.DATABASE_URL || process.env.ERP_V2_AUTO_BOOTSTRAP === 'false') return;
  const pool = getPool();
  const schema = fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8');
  await pool.query(schema);
  const email = process.env.ADMIN_EMAIL || 'admin@gmail.com';
  const password = process.env.ADMIN_PASSWORD || '1234';
  const name = process.env.ADMIN_NAME || 'Administrador';
  const workspaceName = process.env.WORKSPACE_NAME || 'Mi empresa';
  const workspaceSlug = process.env.WORKSPACE_SLUG || 'mi-empresa';
  const workspace = await pool.query(`INSERT INTO workspaces (name,slug) VALUES ($1,$2) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,updated_at=now() RETURNING id`, [workspaceName, workspaceSlug]);
  await pool.query(`INSERT INTO users (workspace_id,email,name,role,password_hash) VALUES ($1,lower($2),$3,'admin',$4) ON CONFLICT (workspace_id,email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,active=true,updated_at=now()`, [workspace.rows[0].id, email, name, hashPassword(password)]);
  console.log(`[ERP V2] Workspace y administrador disponibles para ${email}.`);
}

module.exports = { ensureV2Bootstrap };
