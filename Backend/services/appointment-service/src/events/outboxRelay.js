const Outbox = require('../models/Outbox');
const { producer } = require('./kafkaClient');
const { notifyViaHttp } = require('../utils/notificationFallback');

/**
 * Periodically processes pending messages in the Outbox and sends them to Kafka.
 * This ensures "At-Least-Once" delivery and solves the Dual Write problem.
 */
let draining = false;

async function drainOutbox() {
  // A slow tick must not overlap the next one, or the same row gets sent twice.
  if (draining) return;
  draining = true;

  try {
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
  } catch (err) {
    // Never let a DB hiccup surface as an unhandled rejection and kill the process.
    console.error('❌ Outbox relay tick failed:', err.message);
  } finally {
    draining = false;
  }
}

function startOutboxRelay() {
  console.log('🔄 Outbox Relay Worker started');
  setInterval(drainOutbox, 10000);
  drainOutbox(); // don't make the first event wait 10s
}

module.exports = { startOutboxRelay };
