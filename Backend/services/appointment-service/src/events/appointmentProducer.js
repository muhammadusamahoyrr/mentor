const { producer } = require('./kafkaClient');

async function connectProducer() {
  await producer.connect();
  console.log('Appointment producer connected to Kafka');
}

async function emitAppointmentCreated(payload) {
  try {
    await producer.send({
      topic: 'appointment.created',
      messages: [{ value: JSON.stringify(payload) }],
      timeout: 5000
    });
  } catch (error) {
    console.error('Failed to emit appointment.created event:', error.message);
  }
}

async function emitAppointmentUpdated(payload) {
  try {
    await producer.send({
      topic: 'appointment.updated',
      messages: [{ value: JSON.stringify(payload) }],
      timeout: 5000
    });
  } catch (error) {
    console.error('Failed to emit appointment.updated event:', error.message);
  }
}

module.exports = { connectProducer, emitAppointmentCreated, emitAppointmentUpdated };
