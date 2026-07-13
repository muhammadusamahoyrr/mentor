const { consumer } = require('./kafkaClient');
const { processNotificationEvent } = require('../services/eventProcessor');

async function runConsumer() {
  try {
    await consumer.connect();
    console.log('✅ Notification consumer connected to Kafka');

    const topics = ['appointment.created', 'appointment.updated', 'user.registered'];

    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: false });
      console.log(`✅ Subscribed to topic: ${topic}`);
    }

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          console.log(`📨 Received Kafka message from ${topic}`);
          await processNotificationEvent(topic, payload);
        } catch (err) {
          console.error('❌ Error processing kafka message', err);
        }
      },
    });
  } catch (err) {
    console.error('❌ Kafka consumer failed to start:', err.message);
    console.log('ℹ️  Notifications still work via HTTP fallback when Kafka is down');
    console.log('⏳ Retrying consumer connection in 30 seconds...');
    setTimeout(() => runConsumer(), 30000);
  }
}

module.exports = { runConsumer };
