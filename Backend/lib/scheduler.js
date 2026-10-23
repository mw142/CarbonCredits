const { db } = require('../db');
const { runDueReports } = require('./reports');
const { pullProjectCsv } = require('./project-import');
const { getSetting, setSetting } = require('./settings');
const { marketChanged } = require('./events');

const TICK_MS = Number(process.env.SCHEDULER_TICK_MS || 10 * 60 * 1000);
let running = false;

function expireAvailability() {
  const changes = db.prepare(`
    UPDATE listing_availability SET status = 'expired'
    WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
  `).run().changes;
  if (changes) marketChanged('availability_expired');
  return changes;
}

async function runAutoSync(now = new Date()) {
  if (getSetting('auto_sync_enabled') !== 'true') return null;
  const url = getSetting('cer_source_url');
  if (!url) return null;
  const hours = Math.max(1, Number(getSetting('auto_sync_interval_hours') || 24));
  const last = getSetting('last_auto_sync_at');
  if (last && now - new Date(last) < hours * 3600 * 1000) return null;
  setSetting('last_auto_sync_at', now.toISOString());
  const run = await pullProjectCsv(url, { sourceType: 'scheduled_pull', triggeredBy: 'scheduler' });
  console.log(`[scheduler] CER auto-sync ${run.status}: +${run.records_inserted} ~${run.records_updated}`);
  return run;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    expireAvailability();
    const reports = runDueReports();
    if (reports) console.log(`[scheduler] generated ${reports} scheduled report(s)`);
    await runAutoSync();
  } catch (error) {
    console.error('[scheduler]', error);
  } finally {
    running = false;
  }
}

function startScheduler() {
  setTimeout(tick, 5_000).unref();
  setInterval(tick, TICK_MS).unref();
}

module.exports = { startScheduler, tick, expireAvailability, runAutoSync };
