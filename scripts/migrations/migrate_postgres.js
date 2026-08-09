const fs = require('fs');
const path = require('path');
const { getPool } = require('../../app/config/database');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8');
  const pool = getPool();
  await pool.query(sql);
  await pool.end();
  console.log('PostgreSQL schema aplicado correctamente.');
}

main().catch((error) => {
  console.error('No se pudo aplicar el schema de PostgreSQL:', error.message);
  process.exitCode = 1;
});
