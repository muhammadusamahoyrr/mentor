const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nexushealth';

const appointmentSchema = new mongoose.Schema({
  patientId: String,
  doctorId: String,
  status: String,
  date: String,
  time: String,
  videoUrl: String
}, { strict: false });

const Appointment = mongoose.model('Appointment', appointmentSchema);

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');
    const appointments = await Appointment.find({}).sort({ createdAt: -1 }).limit(10);
    console.log('Last 10 Appointments:');
    appointments.forEach(appt => {
      console.log(`ID: ${appt._id}, Status: ${appt.status}, VideoUrl: ${appt.videoUrl}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
