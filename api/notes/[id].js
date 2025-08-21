// api/notes/[id].js
import pkg from 'pg';
const { Pool } = pkg;

// Lazy-init pool (återanvänds mellan kallstarter)
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

// Se till att tabellen finns (körs en gång per kallstart)
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

    // Hämta id från URL: /api/notes/[id]
    const { id } = req.query || {};
    const idNum = Number(id);

    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const db = getPool();

    if (req.method === 'DELETE') {
      const result = await db.query(`DELETE FROM notes WHERE id = $1`, [idNum]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Not found' });
      }
      // Lyckat: 204 No Content
      return res.status(204).send();
    }

    // (Valfritt framöver: PATCH/GET för ett enskilt id)
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('notes/[id] handler error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
