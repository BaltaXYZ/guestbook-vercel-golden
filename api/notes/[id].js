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

    const { id } = req.query || {};
    const idNum = Number(id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const db = getPool();

    // GET /api/notes/:id
    if (req.method === 'GET') {
      const r = await db.query(
        'SELECT id, name, content, created_at FROM notes WHERE id = $1',
        [idNum]
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(r.rows[0]);
    }

    // PATCH /api/notes/:id
    if (req.method === 'PATCH') {
      const { name, content } = req.body || {};
      if (name === undefined && content === undefined) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      if (content !== undefined && !String(content).trim()) {
        return res.status(400).json({ error: 'Content cannot be empty' });
      }

      const sets = [];
      const values = [];
      let i = 1;

      if (name !== undefined) {
        sets.push(`name = $${i++}`);
        values.push(name && name.trim() ? name : 'Anonym');
      }
      if (content !== undefined) {
        sets.push(`content = $${i++}`);
        values.push(content);
      }

      values.push(idNum);
      const sql =
        `UPDATE notes SET ${sets.join(', ')} WHERE id = $${i} ` +
        `RETURNING id, name, content, created_at`;
      const r = await db.query(sql, values);
      if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(r.rows[0]);
    }

    // DELETE /api/notes/:id
    if (req.method === 'DELETE') {
      const r = await db.query('DELETE FROM notes WHERE id = $1', [idNum]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      return res.status(204).send();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('notes/[id] error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
