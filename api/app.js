// api/app.js — ren version utan notes-hantering
import express from 'express';
import serverless from 'serverless-http';

const app = express();

// Servera statiska filer från /public (nås via /)
app.use(express.static('public'));

// Health check (nås via /api/health på Vercel)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default serverless(app);
