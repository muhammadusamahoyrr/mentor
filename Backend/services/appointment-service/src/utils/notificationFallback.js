const axios = require('axios');

async function notifyViaHttp(topic, event) {
  const baseUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003';
  try {
    await axios.post(
      `${baseUrl}/api/notifications/events`,
      { topic, event },
      { timeout: 5000 }
    );
    console.log(`✅ HTTP fallback: delivered ${topic} to notification service`);
    return true;
  } catch (err) {
    console.error(`❌ HTTP fallback failed for ${topic}:`, err.message);
    return false;
  }
}

module.exports = { notifyViaHttp };
