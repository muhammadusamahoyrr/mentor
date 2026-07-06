const Outbox = require('../models/Outbox');
const { producer } = require('./kafkaClient');
const { notifyViaHttp } = require('../utils/notificationFallback');

/**
 * Periodically processes pending messages in the Outbox and sends them to Kafka.
 * This ensures "At-Least-Once" delivery and solves the Dual Write problem.
 */
async function startOutboxRelay() {
  console.log('🔄 Outbox Relay Worker started');
  
  // Run every 10 seconds
  setInterval(async () => {
    const pendingMessages = await Outbox.find({ status: 'pending' }).limit(10);
    
    for (const msg of pendingMessages) {
      try {
        await producer.send({
          topic: msg.topic,
          messages: [{ value: JSON.stringify(msg.payload) }],
          timeout: 5000,
        });

        msg.status = 'processed';
        await msg.save();
        console.log(`✅ Outbox relay: sent ${msg.topic}`);
      } catch (err) {
        const delivered = await notifyViaHttp(msg.topic, msg.payload);
        if (delivered) {
          msg.status = 'processed';
          msg.error = null;
          await msg.save();
          console.log(`✅ Outbox relay: ${msg.topic} delivered via HTTP fallback`);
        } else {
          msg.retryCount += 1;
          msg.error = err.message;
          if (msg.retryCount > 10) msg.status = 'failed';
          await msg.save();
          console.error(`❌ Outbox relay failed for ${msg.topic}:`, err.message);
        }
      }
    }
  }, 10000);
}

module.exports = { startOutboxRelay };
