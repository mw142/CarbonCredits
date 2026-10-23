const { EventEmitter } = require('node:events');

/**
 * In-process event bus. Anything that changes market-relevant data emits
 * 'market:changed' so the live market stream (SSE) pushes a fresh snapshot.
 */
const bus = new EventEmitter();
bus.setMaxListeners(500);

function marketChanged(reason) {
  bus.emit('market:changed', { reason, at: new Date().toISOString() });
}

module.exports = { bus, marketChanged };
