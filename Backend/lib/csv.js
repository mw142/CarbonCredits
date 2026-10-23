/** Minimal RFC 4180 CSV writer plus helpers for sending CSV/JSON downloads. */

function cell(value) {
  if (value == null) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Neutralise spreadsheet formula injection for values that start with =, +, -, @.
  const safe = /^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * @param {object[]} rows
 * @param {Array<string|[string,string]>} [columns] keys, or [key, header] pairs
 */
function toCsv(rows, columns) {
  const cols = (columns || Object.keys(rows[0] || {})).map((c) => (Array.isArray(c) ? c : [c, c]));
  const lines = [cols.map(([, header]) => cell(header)).join(',')];
  for (const row of rows) lines.push(cols.map(([key]) => cell(row[key])).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

/** Send rows as CSV (default) or JSON depending on ?format=. */
function sendRows(req, res, rows, { name, columns } = {}) {
  const format = String(req.query.format || 'csv').toLowerCase();
  const fileBase = `renewco-${name || 'export'}-${stamp()}`;
  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.json"`);
    return res.json({ exported_at: new Date().toISOString(), count: rows.length, data: rows });
  }
  if (format !== 'csv') return res.status(400).json({ error: 'format must be csv or json.' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.csv"`);
  return res.send(toCsv(rows, columns));
}

module.exports = { toCsv, sendRows };
