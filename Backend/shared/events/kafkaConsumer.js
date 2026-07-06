const { Kafka } = require('kafkajs');

/**
 * Generic Kafka Consumer Wrapper to avoid cross-service boundary violations.
 * Allows services to register their own callbacks without shared code importing service-specific models.
 */
module.exports = (options = {}) => {
  const { 
    clientId = 'shared-consumer', 
    groupId = 'shared-group', 
    topics = [], 
    onMessage = async () => {} 
  } = options;

  const kafka = new Kafka({ 
    clientId, 
    brokers: (process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092').split(',') 
  });
  
  const consumer = kafka.consumer({ groupId });

  (async () => {
    try {
      await consumer.connect();
      console.log(`✅ Generic Kafka consumer "${clientId}" connected to group "${groupId}"`);

      for (const topic of topics) {
        await consumer.subscribe({ topic, fromBeginning: false });
        console.log(`✅ Subscribed to topic: ${topic}`);
      }

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const payload = JSON.parse(message.value.toString());
            await onMessage(topic, payload);
          } catch (err) {
            console.error(`❌ Error parsing/handling Kafka message on topic ${topic}:`, err);
          }
        }
      });
    } catch (err) {
      console.error(`❌ Failed to start generic Kafka consumer for client ${clientId}:`, err);
    }
  })();

  return consumer;
};
