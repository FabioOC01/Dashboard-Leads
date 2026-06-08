const { Pool, types } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Los campos TIMESTAMP WITHOUT TIME ZONE se almacenan en hora Lima (por SET timezone),
// pero el driver pg los interpreta como UTC al crear el objeto Date, generando un
// desfase de -5h en el frontend. Corregimos leyéndolos como Lima (UTC-5).
// Perú NO tiene horario de verano, así que -05:00 es siempre correcto.
types.setTypeParser(1114, (val) => {
  if (!val) return null;
  return new Date(val.replace(' ', 'T') + '-05:00');
});

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: '-c timezone=America/Lima',
});

pool.on('connect', () => {
    console.log('[DB] Conectado a PostgreSQL');
});
pool.on('error', (err) => console.error('[DB] Error:', err));

module.exports = pool;