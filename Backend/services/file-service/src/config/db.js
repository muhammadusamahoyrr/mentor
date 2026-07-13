const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Accept either spelling: every other service uses MONGO_URI, this one
    // shipped with MONGODB_URI. Prefer the service-specific one if both are set.
    const uri =
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      'mongodb://localhost:27017/nexushealth-files';
    const conn = await mongoose.connect(uri);
    console.log(`✅ File Service MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ File Service MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
