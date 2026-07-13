const EventEmitter = require('events');
const axios = require('axios');

class AppointmentEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.notificationServiceUrl = null;
  }

  setupEventForwarding(notificationServiceUrl) {
    this.notificationServiceUrl = notificationServiceUrl;
    
    // Forward events to notification service
    this.on('appointment:created', this.forwardEvent.bind(this));
    this.on('appointment:approved', this.forwardEvent.bind(this));
    this.on('appointment:rejected', this.forwardEvent.bind(this));
  }

  async forwardEvent(data) {
    if (!this.notificationServiceUrl) {
      console.log('Event emitted:', this.eventNames(), data);
      return;
    }

    try {
      await axios.post(`${this.notificationServiceUrl}/api/notifications/events`, {
        event: data
      });
    } catch (error) {
      console.error('Error forwarding event:', error.message);
    }
  }
}

module.exports = new AppointmentEventEmitter();