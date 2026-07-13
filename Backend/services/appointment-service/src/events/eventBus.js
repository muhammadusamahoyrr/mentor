// eventBus — switch implementation with EVENT_DRIVER = 'kafka' | 'http'.
//
// appointment-service does not route its domain events through here: it uses the
// transactional outbox (models/Outbox + events/outboxRelay), which is stronger,
// since it won't lose an event when the broker is down. This module is kept for
// ad-hoc publishing only.
//
// The previous version required '../../shared/events/...', which resolves to
// appointment-service/shared/ — a directory that does not exist — and offered a
// 'redis' driver pointing at a redisPub module that was never written. Either
// branch threw MODULE_NOT_FOUND the moment it was used.
const driver = process.env.EVENT_DRIVER || 'http';

const impl =
  driver === 'kafka'
    ? require('../../../../shared/events/kafkaProducer')
    : require('./httpForwarder');

module.exports = impl;
