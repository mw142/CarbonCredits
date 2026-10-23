const express = require('express');
const { marketSnapshot, priceStats } = require('../lib/market');
const { bus } = require('../lib/events');

const router = express.Router();
const HEARTBEAT_MS = 25_000;
const POLL_MS = 15_000;

router.get('/snapshot', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(marketSnapshot());
});

router.get('/prices', (req, res) => {
  res.json(priceStats(Number(req.query.limit) || 90));
});

/**
 * Live market feed (Server-Sent Events). Pushes a snapshot immediately, again whenever
 * platform data changes (imports, new availability, prices, enquiries), and re-checks
 * every 15 seconds in case another process wrote to the database.
 */
router.get('/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  let lastVersion = null;
  let pending = null;
  const send = (reason = 'update') => {
    try {
      const snap = marketSnapshot();
      if (snap.version === lastVersion) return;
      lastVersion = snap.version;
      res.write(`event: snapshot\ndata: ${JSON.stringify({ ...snap, reason })}\n\n`);
    } catch (error) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
    }
  };
  // Debounce bursts (e.g. a CER import touching thousands of rows).
  const onChange = (event) => {
    clearTimeout(pending);
    pending = setTimeout(() => send(event.reason), 400);
  };

  res.write('retry: 5000\n\n');
  send('initial');
  bus.on('market:changed', onChange);
  const poll = setInterval(() => send('poll'), POLL_MS);
  const heartbeat = setInterval(() => res.write(`: heartbeat ${Date.now()}\n\n`), HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(poll);
    clearInterval(heartbeat);
    clearTimeout(pending);
    bus.off('market:changed', onChange);
  });
});

module.exports = router;
