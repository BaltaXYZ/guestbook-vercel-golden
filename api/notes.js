// api/notes.js
import pkg from 'pg';
const { Pool } = pkg;

// Lazy-init pool (återanvänds mellan kallstart)
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

// Se till att tabellen finns (körs på kallstart)
async function ensure() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Anonym',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`ALTER TABLE notes ALTER COLUMN name SET DEFAULT 'Anonym';`);
  await db.query(`UPDATE notes SET name='Anonym' WHERE name IS NULL OR name = '';`);
}
let initialized = false;

export default async function handler(req, res) {
  try {
    if (!initialized) { await ensure(); initialized = true; }

    const db = getPool();

    if (req.method === 'GET') {
      const { rows } = await db.query(
        `SELECT id, name, content, created_at
         FROM notes
         ORDER BY created_at DESC
         LIMIT 50`
      );
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      let { content, name } = req.body || {};
      content = (content || '').toString().trim();
      name = (name || '').toString().trim() || 'Anonym';
      if (!content) return res.status(400).json({ error: 'Content required' });

      const { rows } = await db.query(
        `INSERT INTO notes (content, name) VALUES ($1, $2)
         RETURNING id, name, content, created_at`,
        [content, name]
      );
      return res.status(200).json(rows[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('notes handler error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
