const { db } = require('../db');

const DEFAULTS = {
  // Where the scheduled pull downloads the CER project register CSV from.
  cer_source_url: process.env.CER_REGISTER_CSV_URL || '',
  auto_sync_enabled: 'false',
  auto_sync_interval_hours: '24',
  last_auto_sync_at: '',
};

function getSetting(key) {
  const row = db.prepare('SELECT value FROM integration_settings WHERE key = ?').get(key);
  return row ? row.value : DEFAULTS[key] ?? null;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO integration_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, value == null ? null : String(value));
}

function allSettings() {
  const out = { ...DEFAULTS };
  for (const row of db.prepare('SELECT key, value FROM integration_settings').all()) out[row.key] = row.value;
  return out;
}

module.exports = { getSetting, setSetting, allSettings };
