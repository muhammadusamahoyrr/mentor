const Notification = require('../models/Notification');
const AppointmentCache = require('../models/AppointmentCache');
const { notifyUser } = require('../socket');

async function processNotificationEvent(topic, payload) {
  if (topic === 'appointment.created' || topic === 'appointment.updated') {
    await AppointmentCache.findOneAndUpdate(
      { appointmentId: payload.appointmentId },
      {
        patientId: payload.patientId,
        patientName: payload.patientName,
        patientEmail: payload.patientEmail,
        doctorId: payload.doctorId,
        doctorName: payload.doctorName,
        date: payload.date,
        time: payload.time,
        status: payload.status || 'pending',
        videoUrl: payload.videoUrl,
      },
      { upsert: true, new: true }
    );
  }

  if (topic === 'appointment.created' && payload.doctorId) {
    const exists = await Notification.findOne({
      userId: payload.doctorId,
      appointmentId: payload.appointmentId,
      type: 'appointment_created',
    });

    if (!exists) {
      const notif = await Notification.create({
        userId: payload.doctorId,
        type: 'appointment_created',
        title: 'New Appointment Request',
        message: `${payload.patientName} requested an appointment on ${payload.date} at ${payload.time}`,
        appointmentId: payload.appointmentId,
      });
      notifyUser(payload.doctorId, notif.toObject());
    }
  }

  if (topic === 'appointment.updated' && payload.patientId) {
    let type = 'appointment_updated';
    let title = 'Appointment Update';
    let messageText = `Your appointment status changed to ${payload.status}`;

    if (payload.status === 'confirmed') {
      type = 'appointment_approved';
      title = 'Appointment Approved';
      messageText = `Your appointment on ${payload.date} at ${payload.time} has been approved.`;
      if (payload.videoUrl) {
        messageText += ' Video link is ready.';
      }
    } else if (payload.status === 'cancelled') {
      type = 'appointment_rejected';
      title = 'Appointment Rejected';
      messageText = 'Your appointment request has been rejected';
    }

    const exists = await Notification.findOne({
      userId: payload.patientId,
      appointmentId: payload.appointmentId,
      type,
    });

    if (!exists) {
      const patientNotif = await Notification.create({
        userId: payload.patientId,
        type,
        title,
        message: messageText,
        appointmentId: payload.appointmentId,
        data: { videoUrl: payload.videoUrl },
      });
      notifyUser(payload.patientId, patientNotif.toObject());

      if (payload.status === 'confirmed') {
        const { sendConfirmationEmail } = require('../utils/mailer');
        await sendConfirmationEmail(payload);
      }
    }

    if (payload.status === 'confirmed' && payload.doctorId) {
      const docExists = await Notification.findOne({
        userId: payload.doctorId,
        appointmentId: payload.appointmentId,
        type: 'appointment_confirmed_doctor',
      });

      if (!docExists) {
        const doctorNotif = await Notification.create({
          userId: payload.doctorId,
          type: 'appointment_confirmed_doctor',
          title: 'Appointment Confirmed',
          message: `You confirmed the appointment for ${payload.patientName} on ${payload.date}. Video link ready.`,
          appointmentId: payload.appointmentId,
          data: { videoUrl: payload.videoUrl },
        });
        notifyUser(payload.doctorId, doctorNotif.toObject());
      }
    }
  }

  if (topic === 'user.registered' && (payload.userId || payload.id)) {
    const userId = payload.userId || payload.id;
    const exists = await Notification.findOne({ userId, type: 'welcome' });
    if (!exists) {
      const notif = await Notification.create({
        userId,
        type: 'welcome',
        title: 'Welcome',
        message: `Welcome ${payload.name}!`,
      });
      notifyUser(userId, notif.toObject());
    }
  }

  if (topic === 'file.shared' && payload.doctorId && payload.patientName) {
    // The outbox relay is at-least-once, so a redelivery must not create a
    // second notification — the appointment branches above already guard this.
    const exists = await Notification.findOne({
      userId: payload.doctorId,
      type: 'file_shared',
      'data.fileId': payload.fileId,
    });

    if (!exists) {
      const notif = await Notification.create({
        userId: payload.doctorId,
        type: 'file_shared',
        title: 'New File Shared',
        message: `${payload.patientName} shared a new medical document with you: ${payload.fileName}`,
        data: { fileId: payload.fileId },
      });
      notifyUser(payload.doctorId, notif.toObject());
    }
  }

  if (topic === 'file.comment_added' && payload.patientId) {
    const exists = await Notification.findOne({
      userId: payload.patientId,
      type: 'file_comment_added',
      'data.fileId': payload.fileId,
      'data.comments': payload.comments,
    });

    if (!exists) {
      const notif = await Notification.create({
        userId: payload.patientId,
        type: 'file_comment_added',
        title: 'Doctor Comment Added',
        message: `Dr. ${payload.doctorName} added a comment on your file: ${payload.fileName}`,
        data: { fileId: payload.fileId, comments: payload.comments },
      });
      notifyUser(payload.patientId, notif.toObject());
    }

    // Also emit a specific Socket.IO event for real-time file update
    const { getIO } = require('../socket');
    const io = getIO();
    if (io) {
      // Emit to both patient and doctor rooms (without user_ prefix to match socket.js)
      const targetRooms = [payload.patientId, payload.doctorId].filter(Boolean);
      
      targetRooms.forEach(userId => {
        const roomId = userId.toString();
        io.to(roomId).emit('file_comment_updated', {
          fileId: payload.fileId,
          fileName: payload.fileName,
          doctorComments: payload.comments,
          doctorName: payload.doctorName,
        });
      });
    }
  }
}

module.exports = { processNotificationEvent };
