const { Kafka, Partitioners } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092').split(','),
  ssl: true,
  sasl: {
    mechanism: 'scram-sha-256',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD
  },
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
