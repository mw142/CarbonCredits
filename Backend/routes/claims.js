const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { saveUpload, filePath } = require('../lib/files');

const router = express.Router();
const RELATIONSHIPS = ['owner', 'proponent', 'authorised_representative', 'project_manager', 'contributor'];
const DOCUMENT_TYPES = ['ownership_evidence', 'authority_document', 'project_agreement', 'registry_export', 'other'];

function claimDetails(claimId, sellerId = null) {
  const claim = db.prepare(`
    SELECT c.*, p.project_reference, p.name AS project_name, p.project_proponent,
           s.name AS seller_name, s.organisation_name
    FROM project_claims c
    JOIN projects p ON p.id = c.project_id
    JOIN user_seller s ON s.id = c.seller_id
    WHERE c.id = ? ${sellerId == null ? '' : 'AND c.seller_id = ?'}
  `).get(...(sellerId == null ? [claimId] : [claimId, sellerId]));
  if (!claim) return null;
  return {
    ...claim,
    documents: db.prepare(`
      SELECT id, document_type, original_file_name, mime_type, file_size_bytes,
             review_status, reviewed_at, review_notes, uploaded_at
      FROM project_claim_documents WHERE claim_id = ? ORDER BY uploaded_at
    `).all(claimId),
  };
}

router.post('/projects/:id/claims', requireAuth, requireRole('seller'), (req, res) => {
  const { relationship_type, documents = [] } = req.body || {};
  if (!RELATIONSHIPS.includes(relationship_type)) {
    return res.status(400).json({ error: `relationship_type must be one of: ${RELATIONSHIPS.join(', ')}.` });
  }
  if (!Array.isArray(documents)) return res.status(400).json({ error: 'documents must be an array.' });

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const activeClaim = db.prepare(`
    SELECT id FROM project_claims
    WHERE project_id = ? AND status IN ('pending', 'additional_information_required', 'approved')
  `).get(project.id);
  if (activeClaim) return res.status(409).json({ error: 'This project already has an active claim.' });

  const claim = db.prepare(
    'INSERT INTO project_claims (project_id, seller_id, relationship_type) VALUES (?, ?, ?)'
  ).run(project.id, req.user.id, relationship_type);
  const claimId = Number(claim.lastInsertRowid);

  try {
    for (const document of documents) {
      if (!DOCUMENT_TYPES.includes(document.document_type)) throw new Error('Invalid claim document type.');
      const file = saveUpload(document);
      db.prepare(`
        INSERT INTO project_claim_documents
          (claim_id, uploaded_by_seller_id, document_type, original_file_name, storage_key, mime_type, file_size_bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(claimId, req.user.id, document.document_type, document.original_file_name, file.storage_key, document.mime_type, file.file_size_bytes);
    }
  } catch (error) {
    db.prepare('DELETE FROM project_claims WHERE id = ?').run(claimId);
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(claimDetails(claimId, req.user.id));
});

router.get('/seller/claims', requireAuth, requireRole('seller'), (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.project_id, c.relationship_type, c.status, c.submitted_at,
           c.verified_at, c.expires_at, c.reviewed_at, c.review_notes, c.rejection_reason,
           p.project_reference, p.name AS project_name, p.project_proponent
    FROM project_claims c JOIN projects p ON p.id = c.project_id
    WHERE c.seller_id = ? ORDER BY c.submitted_at DESC
  `).all(req.user.id);
  res.json(rows);
});

router.get('/seller/claims/:id', requireAuth, requireRole('seller'), (req, res) => {
  const claim = claimDetails(req.params.id, req.user.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found.' });
  res.json(claim);
});

router.get('/seller/claim-documents/:id/download', requireAuth, requireRole('seller'), (req, res) => {
  const document = db.prepare(`SELECT storage_key FROM project_claim_documents WHERE id = ? AND uploaded_by_seller_id = ?`).get(req.params.id, req.user.id);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  try { return res.sendFile(filePath(document.storage_key)); } catch { return res.status(400).json({ error: 'Invalid document key.' }); }
});

router.get('/admin/claim-documents/:id/download', requireAuth, requireRole('admin'), (req, res) => {
  const document = db.prepare('SELECT storage_key FROM project_claim_documents WHERE id = ?').get(req.params.id);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  try { return res.sendFile(filePath(document.storage_key)); } catch { return res.status(400).json({ error: 'Invalid document key.' }); }
});

module.exports = router;
