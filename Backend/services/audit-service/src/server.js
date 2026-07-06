require('dotenv').config();
const { Kafka } = require('kafkajs');
const mongoose = require('mongoose');
const AuditLog = require('./models/AuditLog');

const kafka = new Kafka({
  clientId: 'audit-service',
  brokers: [process.env.KAFKA_BROKER],
  ssl: process.env.KAFKA_SSL === 'true',
  sasl: {
    mechanism: process.env.KAFKA_SASL_MECHANISM || 'scram-sha-256',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
});

const consumer = kafka.consumer({ groupId: 'audit-service-group' });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Audit Service connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

const runAuditLogger = async () => {
  try {
    await connectDB();
    await consumer.connect();
    console.log('✅ Audit Shadow Logger connected to Kafka');

    // Subscribe to ALL topics (Regex subscription)
    await consumer.subscribe({ topics: [/^(user|appointment)\..*$/], fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          
          await AuditLog.create({
            topic,
            payload,
            metadata: {
              service: 'kafka-shadow-logger',
              partition,
              offset: message.offset
            }
          });
          
          console.log(`📜 Audited event: ${topic} (Offset: ${message.offset})`);
        } catch (err) {
          console.error('❌ Error auditing message:', err.message);
        }
      },
    });
  } catch (err) {
    console.error('❌ Audit Service failed to start:', err.message);
    console.log('⏳ Retrying in 5 seconds...');
    setTimeout(runAuditLogger, 5000);
  }
};

runAuditLogger().catch(console.error);

process.on('SIGINT', async () => {
  await consumer.disconnect();
  await mongoose.disconnect();
  process.exit(0);
});
