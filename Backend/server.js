const express = require('express');
const cors = require('cors');

require('./db'); // initialises the SQLite file + schema on first run

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const sellerRoutes = require('./routes/seller');
const buyerRoutes = require('./routes/buyer');
const adminRoutes = require('./routes/admin');
const { requireAuth } = require('./middleware/auth');
const { db } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, role, name, email, phone_number, organisation_name, organisation_type, country, account_status, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(user);
});

app.use('/api/auth', authRoutes);
app.use('/api', projectRoutes); // /api/projects, /api/project-types
app.use('/api/seller', sellerRoutes);
app.use('/api/buyer', buyerRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Carbon Credit Marketplace API running on http://localhost:${PORT}`);
});
