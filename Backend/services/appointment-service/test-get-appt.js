const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const { createMeetingToken } = require('./src/utils/videoRoom');

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
    const appointment = await Appointment.findById('6a2af95765de5bc34b6fca26');
    if (!appointment) {
      console.log('Appointment not found');
      return;
    }
    const apptObj = appointment.toObject();
    console.log('Original Appt Obj:', apptObj);

    if (apptObj.status === 'confirmed' && apptObj.videoUrl) {
      const urlParts = apptObj.videoUrl.split('/');
      const roomName = urlParts[urlParts.length - 1];
      console.log('Room Name:', roomName);
      
      const token = await createMeetingToken(roomName, true); // simulate doctor
      console.log('Generated Token:', token);
      if (token) {
        apptObj.videoUrl = `${apptObj.videoUrl}?t=${token}`;
      }
    }
    console.log('Transformed VideoUrl:', apptObj.videoUrl);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
