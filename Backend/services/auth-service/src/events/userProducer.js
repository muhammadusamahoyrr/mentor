const { producer } = require('./kafkaClient');
const { notifyViaHttp } = require('../utils/notificationFallback');

async function connectProducer() {
  await producer.connect();
  console.log('Auth producer connected to Kafka');
}

async function emitUserRegistered(payload) {
  const event = { ...payload, userId: payload.id };

  try {
    await producer.send({
      topic: 'user.registered',
      messages: [{ value: JSON.stringify(event) }],
      timeout: 5000,
    });
  } catch (error) {
    console.error('Kafka unavailable for user.registered:', error.message);
    await notifyViaHttp('user.registered', event);
  }
}

module.exports = { connectProducer, emitUserRegistered };
