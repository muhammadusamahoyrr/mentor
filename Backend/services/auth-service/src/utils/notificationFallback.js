async function notifyViaHttp(topic, event) {
  const baseUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003';
  try {
    const response = await fetch(`${baseUrl}/api/notifications/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN,
      },
      body: JSON.stringify({ topic, event }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    console.log(`✅ HTTP fallback: delivered ${topic} to notification service`);
    return true;
  } catch (err) {
    console.error(`❌ HTTP fallback failed for ${topic}:`, err.message);
    return false;
  }
}

module.exports = { notifyViaHttp };
