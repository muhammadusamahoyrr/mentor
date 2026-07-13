const mongoose = require('mongoose');

/**
 * Local cache of appointments for the Notification Service.
 * This ensures the Notification Service can run reminders and alerts 
 * without reaching into the Appointment Service's database.
 */
const appointmentCacheSchema = new mongoose.Schema({
  appointmentId: { type: String, required: true, unique: true },
  patientId: { type: String, required: true },
  patientName: { type: String },
  patientEmail: { type: String },
  doctorId: { type: String },
  doctorName: { type: String },
  date: { type: String },
  time: { type: String },
  status: { type: String },
  videoUrl: { type: String },
  reminder24Sent: { type: Boolean, default: false },
  reminder1hSent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('AppointmentCache', appointmentCacheSchema);
