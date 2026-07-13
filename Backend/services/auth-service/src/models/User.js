const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['patient', 'doctor'], default: 'patient' },
  name: String,
  specialization: String,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
