const cron = require('node-cron');
const AppointmentCache = require('../models/AppointmentCache');
const { sendReminderEmail } = require('../utils/mailer');
const { notifyUser } = require('../socket');
const Notification = require('../models/Notification');

/**
 * Runs every 15 minutes to scan for upcoming appointments and send reminders.
 */
cron.schedule('*/15 * * * *', async () => {
  console.log('⏰ Running Appointment Reminder Job...');
  
  try {
    const now = new Date();
    
    // Window calculation for 24h reminders
    const target24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000 + 45 * 60 * 1000); 
    const target24hEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); 

    // Window calculation for 1h reminders
    const target1hStart = new Date(now.getTime() + 45 * 60 * 1000); 
    const target1hEnd = new Date(now.getTime() + 1 * 60 * 60 * 1000); 

    // Process 24h reminders
    const upcoming24h = await AppointmentCache.find({
      status: 'confirmed',
      reminder24Sent: false,
    });

    for (const appt of upcoming24h) {
      if (!appt.date || !appt.time) continue;
      const apptDate = new Date(`${appt.date}T${appt.time}:00`);
      
      if (!isNaN(apptDate.getTime()) && apptDate >= target24hStart && apptDate <= target24hEnd) {
        await processReminder(appt, '24h');
      }
    }

    // Process 1h reminders
    const upcoming1h = await AppointmentCache.find({
      status: 'confirmed',
      reminder1hSent: false,
    });

    for (const appt of upcoming1h) {
      if (!appt.date || !appt.time) continue;
      const apptDate = new Date(`${appt.date}T${appt.time}:00`);
      
      if (!isNaN(apptDate.getTime()) && apptDate >= target1hStart && apptDate <= target1hEnd) {
        await processReminder(appt, '1h');
      }
    }

  } catch (err) {
    console.error('❌ Reminder job error:', err.message);
  }
});

async function processReminder(appt, type) {
  try {
    const emailSent = await sendReminderEmail(appt, type);
    if (!emailSent && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      return;
    }

    // Create In-App Notification
    const label = type === '24h' ? '24 hours' : '1 hour';
    const notif = await Notification.create({
      userId: appt.patientId,
      type: 'appointment_reminder',
      title: 'Upcoming Appointment',
      message: `Reminder: Your appointment with Dr. ${appt.doctorName} is in ${label}.`,
      appointmentId: appt.appointmentId,
      data: { videoUrl: appt.videoUrl }
    });

    // 3. Emit via Socket.io
    notifyUser(appt.patientId, notif.toObject());

    // 4. Mark as sent in local cache
    const updateField = type === '24h' ? { reminder24Sent: true } : { reminder1hSent: true };
    await AppointmentCache.findByIdAndUpdate(appt._id, updateField);
    
    console.log(`✅ ${type} reminder processed for appointment: ${appt.appointmentId}`);
  } catch (err) {
    console.error(`❌ Error processing ${type} reminder for ${appt.appointmentId}:`, err.message);
  }
}

console.log('🚀 Appointment Reminder Cron initialized (Every 15 mins)');
