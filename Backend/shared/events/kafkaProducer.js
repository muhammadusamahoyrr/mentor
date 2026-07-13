const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'smart-healthcare',
  brokers: (process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092').split(','),
});

const producer = kafka.producer();

// Connect lazily, and remember the attempt. The previous version connected in a
// top-level IIFE with no .catch(), so an unreachable broker became an unhandled
// rejection — which terminates the process on modern Node.
let connectPromise = null;

const ensureConnected = () => {
  if (!connectPromise) {
    connectPromise = producer.connect().catch((err) => {
      connectPromise = null; // let a later publish retry
      throw err;
    });
  }
  return connectPromise;
};

module.exports = {
  publish: async (topic, payload) => {
    await ensureConnected();
    // Publish under the real topic name. The old version rewrote dots to dashes
    // ('appointment.created' -> 'appointment-created'), which matched no
    // consumer subscription anywhere in this codebase.
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
  },
};
