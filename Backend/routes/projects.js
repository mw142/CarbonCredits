const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function sellerPublicInfo(sellerId) {
  const s = db.prepare('SELECT name, organisation_name FROM users WHERE id = ?').get(sellerId);
  return s ? { name: s.name, organisation_name: s.organisation_name } : null;
}

function serializeProject(p, opts = {}) {
  const out = {
    id: p.id,
    seller_id: p.seller_id,
    name: p.name,
    location: p.location,
    project_type: p.project_type,
    image_url: p.image_url,
    description: p.description,
    methodology: p.methodology,
    estimated_emission_reductions: p.estimated_emission_reductions,
    accu_category: p.accu_category,
    vintage: p.vintage,
    price_per_credit: p.price_per_credit,
    total_credits: p.total_credits,
    available_credits: p.available_credits,
    review_status: p.review_status,
    is_verified: !!p.is_verified,
    is_listed: !!p.is_listed,
    review_notes: p.review_notes,
    created_at: p.created_at,
    updated_at: p.updated_at,
    seller: sellerPublicInfo(p.seller_id),
  };
  if (opts.withDocuments) {
    out.documents = db
      .prepare('SELECT id, document_type, file_name, uploaded_at FROM project_documents WHERE project_id = ? ORDER BY uploaded_at')
      .all(p.id);
  }
  if (opts.withAudit) {
    out.audit_log = db
      .prepare(
        `SELECT v.id, v.action, v.notes, v.created_at, u.name AS verifier_name
         FROM verification_audit_log v JOIN users u ON u.id = v.verifier_user_id
         WHERE v.project_id = ? ORDER BY v.created_at`
      )
      .all(p.id);
  }
  return out;
}

// GET /api/project-types
router.get('/project-types', (req, res) => {
  res.json(db.prepare('SELECT name FROM project_types ORDER BY name').all().map((r) => r.name));
});

// GET /api/projects  (public marketplace — listed projects only, with filters)
router.get('/projects', (req, res) => {
  const { type, state, search, minPrice, maxPrice, verifiedOnly, sort } = req.query;

  let sql = 'SELECT * FROM projects WHERE is_listed = 1';
  const params = [];

  if (type) {
    sql += ' AND project_type = ?';
    params.push(type);
  }
  if (state) {
    sql += ' AND location LIKE ?';
    params.push(`%${state}%`);
  }
  if (search) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (minPrice) {
    sql += ' AND price_per_credit >= ?';
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    sql += ' AND price_per_credit <= ?';
    params.push(Number(maxPrice));
  }
  if (verifiedOnly === 'true') {
    sql += ' AND is_verified = 1';
  }

  const sortMap = {
    price_asc: 'price_per_credit ASC',
    price_desc: 'price_per_credit DESC',
    newest: 'created_at DESC',
    credits_desc: 'available_credits DESC',
  };
  sql += ` ORDER BY ${sortMap[sort] || 'created_at DESC'}`;

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((p) => serializeProject(p)));
});

// GET /api/projects/:id (public detail — must be listed, or requester is the owner/admin)
router.get('/projects/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found.' });

  if (!p.is_listed) {
    const auth = req.headers.authorization || '';
    if (!auth) return res.status(404).json({ error: 'Project not found.' });
  }
  res.json(serializeProject(p, { withDocuments: true }));
});

// POST /api/projects (seller submits a new project for verification)
router.post('/projects', requireAuth, requireRole('seller'), (req, res) => {
  const {
    name, location, project_type, image_url, description, methodology,
    estimated_emission_reductions, accu_category, vintage,
    price_per_credit, total_credits, documents,
  } = req.body || {};

  if (!name || !location || !project_type || price_per_credit == null || total_credits == null) {
    return res.status(400).json({ error: 'name, location, project_type, price_per_credit and total_credits are required.' });
  }

  const validType = db.prepare('SELECT name FROM project_types WHERE name = ?').get(project_type);
  if (!validType) return res.status(400).json({ error: 'Unknown project_type.' });

  const info = db.prepare(`
    INSERT INTO projects
      (seller_id, name, location, project_type, image_url, description, methodology,
       estimated_emission_reductions, accu_category, vintage, price_per_credit,
       total_credits, available_credits, review_status, is_verified, is_listed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting_review', 0, 0)
  `).run(
    req.user.id, name, location, project_type, image_url || null, description || null, methodology || null,
    estimated_emission_reductions ?? null, accu_category || null, vintage || null,
    Number(price_per_credit), Number(total_credits), Number(total_credits)
  );

  const projectId = Number(info.lastInsertRowid);

  if (Array.isArray(documents)) {
    documents.forEach((doc) => {
      if (doc && doc.file_name) {
        db.prepare(
          `INSERT INTO project_documents (project_id, uploaded_by_user_id, document_type, file_name) VALUES (?, ?, ?, ?)`
        ).run(projectId, req.user.id, doc.document_type || 'other', doc.file_name);
      }
    });
  }

  db.prepare(
    `INSERT INTO verification_audit_log (project_id, verifier_user_id, action, notes) VALUES (?, ?, 'submitted', 'Submitted by seller for verification')`
  ).run(projectId, req.user.id);

  const created = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  res.status(201).json(serializeProject(created, { withDocuments: true, withAudit: true }));
});

// PATCH /api/projects/:id (seller edits their own project — resets to waiting_review if it changes verified facts)
router.patch('/projects/:id', requireAuth, requireRole('seller'), (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found.' });
  if (p.seller_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own projects.' });

  const fields = ['name', 'location', 'image_url', 'description', 'methodology', 'price_per_credit', 'accu_category', 'vintage'];
  const updates = [];
  const params = [];
  fields.forEach((f) => {
    if (req.body && req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  });
  if (updates.length === 0) return res.status(400).json({ error: 'No editable fields provided.' });

  updates.push("updated_at = CURRENT_TIMESTAMP");
  params.push(req.params.id);
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(serializeProject(updated, { withDocuments: true, withAudit: true }));
});

// POST /api/projects/:id/list  (publish a verified listing to the marketplace)
router.post('/projects/:id/list', requireAuth, requireRole('seller'), (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found.' });
  if (p.seller_id !== req.user.id) return res.status(403).json({ error: 'You can only manage your own projects.' });
  if (!p.is_verified) return res.status(400).json({ error: 'Only verified projects can be listed on the marketplace.' });

  db.prepare("UPDATE projects SET is_listed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(p.id);
  db.prepare(
    `INSERT INTO verification_audit_log (project_id, verifier_user_id, action, notes) VALUES (?, ?, 'listed', 'Seller published listing to marketplace')`
  ).run(p.id, req.user.id);

  res.json(serializeProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(p.id)));
});

// POST /api/projects/:id/unlist
router.post('/projects/:id/unlist', requireAuth, requireRole('seller'), (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found.' });
  if (p.seller_id !== req.user.id) return res.status(403).json({ error: 'You can only manage your own projects.' });

  db.prepare("UPDATE projects SET is_listed = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(p.id);
  db.prepare(
    `INSERT INTO verification_audit_log (project_id, verifier_user_id, action, notes) VALUES (?, ?, 'unlisted', 'Seller removed listing from marketplace')`
  ).run(p.id, req.user.id);

  res.json(serializeProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(p.id)));
});

router.serializeProject = serializeProject;
module.exports = router;
