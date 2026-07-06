const Appointment = require('../models/Appointment');
const Note = require('../models/Note');
const DoctorCache = require('../models/DoctorCache');
const Outbox = require('../models/Outbox');
const mongoose = require('mongoose');
const axios = require('axios');
const { asyncHandler, AppError } = require('../../../../shared/middleware/errorHandler');
const { createMeetingToken } = require('../utils/videoRoom');

const normalizeId = (id) => String(id ?? '');

const isAppointmentParticipant = (appointment, userId) =>
  normalizeId(appointment.patientId) === normalizeId(userId) ||
  normalizeId(appointment.doctorId) === normalizeId(userId);

// Transform appointment for frontend
const transformAppointment = (appointment) => {
  if (!appointment) return null;
  
  // If it's a Mongoose document, convert to plain object.
  // If it's already a plain object, use it as is.
  const obj = (typeof appointment.toObject === 'function') 
    ? appointment.toObject() 
    : appointment;
  
  return {
    id: obj._id ? obj._id.toString() : (obj.id ? String(obj.id) : null),
    _id: obj._id ? obj._id.toString() : (obj.id ? String(obj.id) : null),
    patientId: obj.patientId,
    doctorId: obj.doctorId,
    date: obj.date,
    time: obj.time,
    reason: obj.reason,
    status: obj.status,
    videoUrl: obj.videoUrl, 
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    // Embedded user data
    patient: {
      id: obj.patientId,
      name: obj.patientName,
      email: obj.patientEmail
    },
    doctor: {
      id: obj.doctorId,
      name: obj.doctorName,
      specialization: obj.doctorSpecialization
    }
  };
};

// Create appointment
exports.createAppointment = asyncHandler(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { doctorId, date, time, reason } = req.body;
    
    if (!doctorId || !date || !time || !reason) {
      throw new AppError('All fields required', 400);
    }

    // --- Resolve doctor info: local cache first, HTTP fallback ---
    let doctorInfo = await DoctorCache.findOne({ authUserId: doctorId }).session(session);

    if (!doctorInfo) {
      console.warn(`⚠️  Doctor ${doctorId} not in local cache — fetching from auth service...`);
      try {
        const authUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
        const { data } = await axios.get(`${authUrl}/api/auth/users/${doctorId}`, { timeout: 5000 });

        if (!data || data.role !== 'doctor') {
          throw new AppError('Doctor not found', 404);
        }

        // Seed the local cache so subsequent bookings are instant
        doctorInfo = await DoctorCache.findOneAndUpdate(
          { authUserId: doctorId },
          { name: data.name, email: data.email, specialization: data.specialization },
          { upsert: true, new: true, session }
        );
        console.log(`✅ Doctor cache seeded from auth service: ${data.name}`);
      } catch (err) {
        if (err.isOperational) throw err;
        throw new AppError('Doctor not found — auth service unavailable', 503);
      }
    }

    // Create appointment
    const appointment = await Appointment.create([{
      patientId: req.user.id,
      patientName: req.user.name,
      patientEmail: req.user.email,
      doctorId: doctorId,
      doctorName: doctorInfo.name,
      doctorSpecialization: doctorInfo.specialization,
      date,
      time,
      reason,
      status: 'pending'
    }], { session });

    const createdAppointment = appointment[0];

    // --- FIX 1: Solve Dual Write (Transactional Outbox) ---
    await Outbox.create([{
      topic: 'appointment.created',
      payload: {
        appointmentId: createdAppointment._id.toString(),
        doctorId: doctorId,
        patientId: req.user.id,
        patientName: req.user.name,
        date,
        time,
        reason
      }
    }], { session });

    await session.commitTransaction();
    console.log('✅ Appointment and Outbox entry created atomically');

    res.status(201).json(transformAppointment(createdAppointment));
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

// Get my appointments
exports.getMyAppointments = asyncHandler(async (req, res, next) => {
  const query = req.user.role === 'patient' 
    ? { patientId: req.user.id } 
    : { doctorId: req.user.id };
  
  const list = await Appointment.find(query).sort({ createdAt: -1 });
  res.json(list.map(appt => transformAppointment(appt)));
});

// Get single appointment (with secure meeting token generation)
exports.getAppointmentById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const appointment = await Appointment.findById(id);
  
  if (!appointment) {
    return next(new AppError('Appointment not found', 404));
  }

  // Security check: Only patient or doctor involved can view
  if (!isAppointmentParticipant(appointment, req.user.id)) {
    return next(new AppError('Not authorized to view this appointment', 403));
  }

  const apptData = appointment.toObject();

  // On-the-fly token generation ONLY when specifically requesting this appointment
  if (apptData.status === 'confirmed' && apptData.videoUrl) {
    try {
      // Robust room name extraction: handle trailing slashes and query params if any
      const url = new URL(apptData.videoUrl);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      const roomName = pathSegments[pathSegments.length - 1];
      
      if (roomName) {
        const token = await createMeetingToken(
          roomName, 
          req.user.role === 'doctor',
          req.user.name
        );
        if (token) {
          apptData.videoUrl = `${apptData.videoUrl}?t=${token}`;
          console.log(`✅ Meeting token attached for room: ${roomName}`);
        } else {
          console.warn(`⚠️ Failed to generate token for room: ${roomName}`);
        }
      }
    } catch (err) {
      console.error('❌ Error parsing videoUrl or generating token:', err.message);
    }
  }

  res.json(transformAppointment(apptData));
});

// Update appointment status (doctor or patient for cancel)
exports.updateAppointmentStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status) {
    return next(new AppError('Status is required', 400));
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return next(new AppError('Appointment not found', 404));
  }

  const userId = req.user.id;
  const userRole = req.user.role;
  const isDoctor = userRole === 'doctor' && normalizeId(appointment.doctorId) === normalizeId(userId);
  const isPatient = userRole === 'patient' && normalizeId(appointment.patientId) === normalizeId(userId);

  // Idempotent: already in the requested state
  if (appointment.status === status) {
    return res.json(transformAppointment(appointment));
  }

  let authorized = false;

  if (isDoctor) {
    if (status === 'completed' && !['confirmed', 'pending'].includes(appointment.status)) {
      return next(new AppError('Only active appointments can be completed.', 403));
    }
    authorized = true;
  } else if (isPatient) {
    if (
      (status === 'cancelled' && (appointment.status === 'pending' || appointment.status === 'confirmed')) ||
      (status === 'completed' && appointment.status === 'confirmed')
    ) {
      authorized = true;
    } else {
      return next(new AppError('Patients can only cancel pending/confirmed appointments or complete confirmed ones.', 403));
    }
  }

  if (!authorized) {
    return next(new AppError('Not authorized to perform this status update.', 403));
  }

  let videoUrl = null;
  if (status === 'confirmed' && !appointment.videoUrl) {
    console.log('📹 Generating Video Room for appointment:', id);
    try {
      const { createVideoRoom } = require('../utils/videoRoom');
      videoUrl = await createVideoRoom(appointment._id.toString());
    } catch (err) {
      console.error('Failed to generate daily.co video room:', err.message);
    }
  }

  appointment.status = status;
  if (videoUrl) {
    appointment.videoUrl = videoUrl;
  }
  
  const outboxMsg = {
    topic: 'appointment.updated',
    payload: {
      appointmentId: appointment._id.toString(),
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      patientEmail: appointment.patientEmail,
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName,
      status: status,
      date: appointment.date,
      time: appointment.time,
      videoUrl: appointment.videoUrl || null
    }
  };

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await appointment.save({ session });
    await Outbox.create([outboxMsg], { session });
    await session.commitTransaction();
    console.log(`✅ Appointment status updated to ${status} and Outbox entry created`);
    res.json(transformAppointment(appointment));
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

// --- Appointment -> Notes (one-to-many relationship) ---

// Add a clinical note to an appointment
exports.addNote = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { body } = req.body;

  if (!body || body.trim() === '') {
    return next(new AppError('Note body is required', 400));
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return next(new AppError('Appointment not found', 404));
  }

  // Only the patient or doctor on the appointment may add notes
  if (!isAppointmentParticipant(appointment, req.user.id)) {
    return next(new AppError('Not authorized to add notes to this appointment', 403));
  }

  const note = await Note.create({
    appointment: appointment._id,
    authorId: req.user.id,
    authorName: req.user.name,
    authorRole: req.user.role,
    body: body.trim(),
  });

  res.status(201).json(note);
});

// List notes for an appointment (parent joined in via .populate())
exports.getAppointmentNotes = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return next(new AppError('Appointment not found', 404));
  }

  if (!isAppointmentParticipant(appointment, req.user.id)) {
    return next(new AppError('Not authorized to view notes for this appointment', 403));
  }

  // populate() resolves the `appointment` ObjectId ref into the selected fields.
  const notes = await Note.find({ appointment: id })
    .populate('appointment', 'date time reason status')
    .sort({ createdAt: -1 });

  res.json(notes);
});

// Delete appointment
exports.deleteAppointment = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const appointment = await Appointment.findById(id);
  
  if (!appointment) {
    return next(new AppError('Appointment not found', 404));
  }

  if (req.user.role === 'patient' && normalizeId(appointment.patientId) !== normalizeId(req.user.id)) {
    return next(new AppError('Not authorized', 403));
  }

  await appointment.deleteOne();
  res.json({ message: 'Appointment deleted' });
});
