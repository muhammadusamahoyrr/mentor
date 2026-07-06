const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  // Store IDs as strings (not ObjectId references since User is in another service)
  patientId: { type: String, required: true },
  doctorId: { type: String, required: true },
  
  // Store denormalized user data (no need to populate)
  patientName: { type: String, required: true },
  patientEmail: { type: String, required: true },
  doctorName: { type: String, required: true },
  doctorSpecialization: { type: String },
  
  // Appointment details
  date: { type: String, required: true },
  time: { type: String, required: true },
  reason: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending' 
  },
  videoUrl: { type: String, default: null },
  reminder24Sent: { type: Boolean, default: false },
  reminder1hSent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);