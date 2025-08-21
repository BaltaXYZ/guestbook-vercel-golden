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
app.use(async (req, res, next) => {
  if (!initialized) {
    try {
      await ensureTables();
      initialized = true;
    } catch (err) {
      console.error('Error ensuring tables:', err);
      return res.status(500).json({ error: 'Database init failed' });
    }
  }
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Get notes
app.get('/notes', async (_req, res) => {
  try {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT id, name, content, created_at
       FROM notes
       ORDER BY created_at DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching notes:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create note
app.post('/notes', async (req, res) => {
  try {
    const db = getPool();
    let { content, name } = req.body || {};
    content = (content || '').toString().trim();
    name = (name || '').toString().trim();
    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }
    if (!name) {
      name = 'Anonym';
    }
    const { rows } = await db.query(
      `INSERT INTO notes (content, name) VALUES ($1, $2)
       RETURNING id, name, content, created_at`,
      [content, name]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error creating note:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update note
app.patch('/notes/:id', async (req, res) => {
  try {
    const db = getPool();
    const id = req.params.id;
    const { content, name } = req.body || {};
    const setClauses = [];
    const values = [];
    let index = 1;

    if (name !== undefined) {
      const sanitized = name.toString().trim();
      setClauses.push(`name = $${index++}`);
      values.push(sanitized ? sanitized : 'Anonym');
    }
    if (content !== undefined) {
      setClauses.push(`content = $${index++}`);
      values.push(content.toString());
    }
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    values.push(id);
    const { rows } = await db.query(
      `UPDATE notes SET ${setClauses.join(', ')} WHERE id = $${index}
       RETURNING id, name, content, created_at`,
      values
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating note:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete note — stöd både /notes/:id och /api/notes/:id
const deleteHandlers = async (req, res) => {
  try {
    const db = getPool();
    const idNum = Number(req.params.id);
    if (!Number.isInteger(idNum)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const result = await db.query(`DELETE FROM notes WHERE id = $1`, [idNum]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(204).send();
  } catch (err) {
    console.error('Error deleting note:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

app.delete('/notes/:id', deleteHandlers);
app.delete('/api/notes/:id', deleteHandlers); // extra kompatibilitet

export default serverless(app);
