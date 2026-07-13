const { Kafka } = require('kafkajs');

// The localhost:9092 default is a plaintext broker with no auth, so TLS and
// SASL cannot be unconditional or every local run fails to connect. SASL is
// sent only when credentials exist; TLS follows them (a managed broker needs
// both) unless KAFKA_SSL says otherwise. Defaulting TLS off instead would
// silently downgrade any deployment that relied on the old hardcoded ssl:true.
const useSasl = Boolean(process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD);

const kafka = new Kafka({
  clientId: 'smart-healthcare',
  brokers: (process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092').split(','),
  ssl: process.env.KAFKA_SSL ? process.env.KAFKA_SSL === 'true' : useSasl,
  ...(useSasl && {
    sasl: {
      mechanism: process.env.KAFKA_SASL_MECHANISM || 'scram-sha-256',
      username: process.env.KAFKA_USERNAME,
      password: process.env.KAFKA_PASSWORD
    }
  })
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'smart-healthcare-group' });

module.exports = { kafka, producer, consumer };
