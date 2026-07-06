// eventBus - switch implementation by env variable EVENT_DRIVER = 'kafka'|'redis'|'http'
const driver = process.env.EVENT_DRIVER || 'http';

let impl;
if (driver === 'kafka') impl = require('../../shared/events/kafkaProducer');
else if (driver === 'redis') impl = require('../../shared/events/redisPub');
else impl = require('./httpForwarder'); // fallback to your original HTTP forwarder

module.exports = impl;
