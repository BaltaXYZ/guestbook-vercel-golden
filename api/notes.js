// api/notes.js
import pkg from 'pg';
const { Pool } = pkg;

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

let initialized = false;
async function ensure() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Anonym',
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`ALTER TABLE notes ALTER COLUMN name SET DEFAULT 'Anonym';`);
  await db.query(`UPDATE notes SET name='Anonym' WHERE name IS NULL OR name = ''`);
}

export default async function handler(req, res) {
  try {
    if (!initialized) { await ensure(); initialized = true; }
    const db = getPool();

    if (req.method === 'GET') {
      const r = await db.query(
        'SELECT id, name, content, created_at FROM notes ORDER BY created_at DESC'
      );
      return res.status(200).json(r.rows);
    }

    if (req.method === 'POST') {
      const { name, content } = req.body || {};
      if (!content || !String(content).trim()) {
        return res.status(400).json({ error: 'Content is required' });
      }
      const safeName = name && name.trim() ? name : 'Anonym';
      const r = await db.query(
        `INSERT INTO notes (name, content)
           VALUES ($1, $2)
           RETURNING id, name, content, created_at`,
        [safeName, content]
      );
      return res.status(201).json(r.rows[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('notes error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
