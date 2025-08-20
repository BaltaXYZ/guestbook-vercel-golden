import express from 'express';
import pkg from 'pg';
import serverless from 'serverless-http';

// Destructure Pool from pg
const { Pool } = pkg;

// Initialize Express app
const app = express();
app.use(express.json());

// Serve static files from the public folder
app.use(express.static('public'));

// Configure database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Ensure notes table and name column exist and backfill defaults
async function ensure() {
  // Create notes table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Anonym',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  // Add the name column if it doesn't exist (for safety)
  await pool.query(`ALTER TABLE notes ADD COLUMN IF NOT EXISTS name TEXT;`);
  // Backfill any existing rows where name is null or empty
  await pool.query(`UPDATE notes SET name='Anonym' WHERE name IS NULL OR name = '';`);
  // Set default for name column
  await pool.query(`ALTER TABLE notes ALTER COLUMN name SET DEFAULT 'Anonym';`);
}

// Call ensure() without awaiting to avoid top-level await
ensure().catch((err) => {
  console.error('Error ensuring notes table:', err);
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Get the latest 50 notes
app.get('/notes', async (_req, res) => {
  try {
    const { rows } = await pool.query(
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

// Create a new note
app.post('/notes', async (req, res) => {
  try {
    let { content, name } = req.body || {};
    content = (content || '').toString().trim();
    name = (name || '').toString().trim();
    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }
    if (!name) {
      name = 'Anonym';
    }
    const { rows } = await pool.query(
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

// Update an existing note
app.patch('/notes/:id', async (req, res) => {
  try {
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
    // Append id at the end
    values.push(id);
    const { rows } = await pool.query(
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

// Delete a note
app.delete('/notes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query(
      `DELETE FROM notes WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error('Error deleting note:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export the serverless handler
export default serverless(app);
