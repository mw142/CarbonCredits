const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

require('./lib/env').loadEnv();
require('./db'); // initialises the SQLite file + schema on first run, applies features.sql

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const sellerRoutes = require('./routes/seller');
const buyerRoutes = require('./routes/buyer');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');
const { requireAuth } = require('./middleware/auth');
const { db } = require('./db');
const { tableForRole, publicUser } = require('./lib/users');
const { startScheduler } = require('./lib/scheduler');

const app = express();
const PORT = process.env.PORT || 4000;

// Behind Nginx in production: use the real client IP from X-Forwarded-For.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.use(cors());
app.use(express.json({ limit: '36mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, brand: 'renewCo.', poweredBy: 'IrongateIT' }));

app.get('/api/me', requireAuth, (req, res) => {
  const columns = req.user.role === 'admin'
    ? 'id, name, email, phone_number, account_status, created_at'
    : 'id, name, email, phone_number, organisation_name, organisation_type, country, account_status, created_at';
  const user = db.prepare(`SELECT ${columns} FROM ${tableForRole(req.user.role)} WHERE id = ?`).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(publicUser(user, req.user.role));
});

app.use('/api/auth', authRoutes);
app.use('/api/market', require('./routes/market'));
app.use('/api/v1', require('./routes/api-v1'));
app.use('/api/export', require('./routes/exports'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api', require('./routes/site'));
app.use('/api', projectRoutes);
app.use('/api', require('./routes/claims'));
app.use('/api', require('./routes/listings'));
app.use('/api', require('./routes/evidence'));
app.use('/api', require('./routes/contact'));
app.use('/api/seller', sellerRoutes);
app.use('/api/buyer', buyerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// In production, serve the built frontend (npm run build in Frontend/) from the same origin.
const DIST = path.join(__dirname, '../Frontend/dist');
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'The upload is too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body is not valid JSON.' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

if (require.main === module) {
  app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
    console.log(`renewCo. carbon marketplace API (powered by IrongateIT) on http://localhost:${PORT}`);
    console.log(`Groq chatbot: ${process.env.GROQ_API_KEY ? `configured (${process.env.GROQ_MODEL || 'openai/gpt-oss-20b'})` : 'not configured — set GROQ_API_KEY in Backend/.env'}`);
    startScheduler();
  });
}

module.exports = app;
