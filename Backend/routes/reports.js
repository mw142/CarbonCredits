const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  REPORT_TYPES, FREQUENCIES, generateReport, getReport, ensureDefaultSchedules, setSchedule, reportRows, previousPeriod, iso,
} = require('../lib/reports');
const { sendRows } = require('../lib/csv');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const { role, id } = req.user;
  ensureDefaultSchedules(role, id);
  const reports = db.prepare(`
    SELECT id, report_type, title, period_start, period_end, trigger, created_at
    FROM generated_reports WHERE owner_role = ? AND owner_id = ? ORDER BY created_at DESC, id DESC LIMIT 100
  `).all(role, id);
  const schedules = db.prepare(`
    SELECT report_type, frequency, next_run_at, last_run_at FROM report_schedules WHERE owner_role = ? AND owner_id = ?
  `).all(role, id);
  const [start, end] = previousPeriod('monthly');
  res.json({
    types: REPORT_TYPES[role] || [],
    frequencies: FREQUENCIES,
    schedules,
    reports,
    default_period: { start: iso(start), end: iso(end) },
  });
});

router.post('/generate', (req, res) => {
  const { report_type, period_start, period_end } = req.body || {};
  try {
    const report = generateReport({ role: req.user.role, ownerId: req.user.id, type: report_type, start: period_start, end: period_end });
    res.status(201).json(report);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.put('/schedules', (req, res) => {
  try {
    setSchedule(req.user.role, req.user.id, req.body?.report_type, req.body?.frequency);
    res.json({ ok: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  const report = getReport(req.params.id, req.user.role, req.user.id);
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  res.json(report);
});

router.get('/:id/export', (req, res) => {
  const report = getReport(req.params.id, req.user.role, req.user.id);
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  if (String(req.query.format) === 'json') return sendRows(req, res, [report], { name: `report-${report.id}` });
  return sendRows(req, res, reportRows(report), { name: `report-${report.id}`, columns: [['section', 'Section'], ['metric', 'Metric'], ['value', 'Value'], ['unit', 'Unit']] });
});

router.delete('/:id', (req, res) => {
  const changes = db.prepare('DELETE FROM generated_reports WHERE id = ? AND owner_role = ? AND owner_id = ?').run(req.params.id, req.user.role, req.user.id).changes;
  if (!changes) return res.status(404).json({ error: 'Report not found.' });
  res.json({ ok: true });
});

module.exports = router;
