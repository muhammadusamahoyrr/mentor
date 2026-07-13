const axios = require('axios');
module.exports = {
  publish: async (topic, payload) => {
    const url = process.env.NOTIFICATION_SERVICE_URL;
    if (!url) return console.warn('NO NOTIFICATION_SERVICE_URL set; event', topic, payload);
    try {
      await axios.post(
        `${url}/api/notifications/events`,
        { event: payload, topic },
        { headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN } }
      );
    } catch (err) {
      console.error('HTTP Event forward error:', err.message);
    }
  }
};
