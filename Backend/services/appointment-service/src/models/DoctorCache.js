const mongoose = require('mongoose');

const doctorCacheSchema = new mongoose.Schema({
  authUserId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String },
  specialization: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('DoctorCache', doctorCacheSchema);
