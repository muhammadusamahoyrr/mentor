const { Kafka, Partitioners } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'auth-service',
  brokers: (process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092').split(','),
  ssl: true,
  sasl: {
    mechanism: 'scram-sha-256',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD
  },
  retry: {
    initialRetryTime: 300,   // ms — prevents undefined/NaN in backoff math
    retries: 5,
    maxRetryTime: 30000,
    factor: 0.2,
    multiplier: 2,
  },
  connectionTimeout: 10000,  // 10s explicit connection timeout
  requestTimeout: 30000,     // 30s explicit request timeout
});

// Use LegacyPartitioner to suppress KafkaJS v2 partitioner warning
const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });

module.exports = { kafka, producer };
