import fs from 'node:fs/promises';
import pg from 'pg';
import { seed } from './seedData.js';

// Створення бази даних, застосування схеми db/schema.sql і додавання тестових даних.

export async function ensureDatabase(connectionString) {
  const url = new URL(connectionString);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount === 0) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) throw new Error(`Недопустима назва бази даних: ${dbName}`);
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Створено базу даних ${dbName}`);
    }
  } finally {
    await admin.end();
  }
}

export async function resetDatabase(connectionString, { withSeed = true } = {}) {
  await ensureDatabase(connectionString);
  const schema = await fs.readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const pool = new pg.Pool({ connectionString });
  try {
    await pool.query(schema);
    if (withSeed) await seed(pool);
  } finally {
    await pool.end();
  }
}
