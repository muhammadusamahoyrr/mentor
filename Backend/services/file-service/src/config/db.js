const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexushealth-files');
    console.log(`✅ File Service MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ File Service MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
