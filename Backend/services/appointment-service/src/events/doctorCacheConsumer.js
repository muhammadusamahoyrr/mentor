const { kafka } = require('./kafkaClient');
const DoctorCache = require('../models/DoctorCache');

const consumer = kafka.consumer({ groupId: 'appointment-doctor-cache' });

/**
 * Listens for user registration events to keep a local cache of doctors.
 * This solves the Cascading Failure problem by removing synchronous dependency on Auth Service.
 */
async function runDoctorCacheConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'user.registered', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          
          if (payload.role === 'doctor') {
            await DoctorCache.findOneAndUpdate(
              { authUserId: payload.id },
              { 
                name: payload.name, 
                email: payload.email, 
                specialization: payload.specialization 
              },
              { upsert: true, new: true }
            );
            console.log(`👤 Doctor cache updated: ${payload.name}`);
          }
        } catch (err) {
          console.error('❌ Error updating doctor cache:', err.message);
        }
      }
    });
  } catch (err) {
    console.error('❌ Doctor cache consumer failed:', err.message);
  }
}

module.exports = { runDoctorCacheConsumer };
