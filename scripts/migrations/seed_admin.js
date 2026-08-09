const { getPool } = require('../../app/config/database');
const { hashPassword } = require('../../app/auth/passwords');

async function main() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'Administrador', WORKSPACE_NAME = 'Mi empresa', WORKSPACE_SLUG = 'mi-empresa' } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios');

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const workspace = await client.query(
      `INSERT INTO workspaces (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id`,
      [WORKSPACE_NAME, WORKSPACE_SLUG]
    );
    await client.query(
      `INSERT INTO users (workspace_id, email, name, role, password_hash)
       VALUES ($1, lower($2), $3, 'admin', $4)
       ON CONFLICT (workspace_id, email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, active = true, updated_at = now()`,
      [workspace.rows[0].id, ADMIN_EMAIL, ADMIN_NAME, hashPassword(ADMIN_PASSWORD)]
    );
    await client.query('COMMIT');
    console.log(`Administrador creado/actualizado para ${ADMIN_EMAIL}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('No se pudo crear el administrador:', error.message);
  process.exitCode = 1;
});
