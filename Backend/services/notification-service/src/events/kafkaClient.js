const { Kafka, Partitioners } = require('kafkajs');

// The localhost:9092 default is a plaintext broker with no auth, so TLS and
// SASL cannot be unconditional or every local run fails to connect. SASL is
// sent only when credentials exist; TLS follows them (a managed broker needs
// both) unless KAFKA_SSL says otherwise. Defaulting TLS off instead would
// silently downgrade any deployment that relied on the old hardcoded ssl:true.
const useSasl = Boolean(process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD);

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092').split(','),
  ssl: process.env.KAFKA_SSL ? process.env.KAFKA_SSL === 'true' : useSasl,
  ...(useSasl && {
    sasl: {
      mechanism: process.env.KAFKA_SASL_MECHANISM || 'scram-sha-256',
      username: process.env.KAFKA_USERNAME,
      password: process.env.KAFKA_PASSWORD
    }
  }),
  retry: {
    initialRetryTime: 300,
    retries: 5,
    maxRetryTime: 30000,
    factor: 0.2,
    multiplier: 2,
  },
  connectionTimeout: 10000,
  requestTimeout: 30000,
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

module.exports = { kafka, consumer, Partitioners };
