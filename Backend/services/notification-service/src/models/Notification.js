const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: String,
  type: String,
  title: String,
  message: String,
  read: { type: Boolean, default: false },
  appointmentId: String,
  data: mongoose.Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
