import express from 'express';
import pkg from 'pg';
import serverless from 'serverless-http';

const { Pool } = pkg;

// Lazy-init pool
let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

// Ensure table exists
async function ensureTables() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Anonym',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(
    `ALTER TABLE notes ALTER COLUMN name SET DEFAULT 'Anonym';`
  );
  await db.query(
    `UPDATE notes SET name='Anonym' WHERE name IS NULL OR name = '';`
  );
}

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Middleware: kör ensureTables() första gången
let initialized = false;
a
