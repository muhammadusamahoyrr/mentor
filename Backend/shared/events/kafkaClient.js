const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'smart-healthcare',
  brokers: (process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092').split(','),
  ssl: true,
  sasl: {
    mechanism: 'scram-sha-256', // or scram-sha-512
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD
  }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'smart-healthcare-group' });

module.exports = { kafka, producer, consumer };
