const { Kafka } = require('kafkajs');
const kafka = new Kafka({ clientId: 'appointment-service', brokers: (process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092').split(',') });
const producer = kafka.producer();

(async () => {
  await producer.connect();
  console.log('Kafka producer connected');
})();

module.exports = {
  publish: async (topic, payload) => {
    const t = topic.replace(/\./g,'-');
    await producer.send({ topic: t, messages: [{ value: JSON.stringify(payload) }] });
  }
};
