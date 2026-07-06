const nodemailer = require('nodemailer');

/**
 * Mailer utility for sending appointment reminders.
 * Requires EMAIL_USER and EMAIL_PASS (App Password) in .env
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Sends a reminder email to a patient.
 * @param {Object} appointment - The appointment document
 * @param {string} type - '24h' or '1h'
 */
const sendReminderEmail = async (appointment, type) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Mailer: Set EMAIL_USER and EMAIL_PASS in notification-service/.env to enable emails.');
    return false;
  }

  const label = type === '24h' ? '24 hours' : '1 hour';
  
  try {
    await transporter.sendMail({
      from: `"NexusHealth Reminders" <${process.env.EMAIL_USER}>`,
      to: appointment.patientEmail, // We store patientEmail directly in the model
      subject: `Appointment Reminder — ${label} to go`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
          <h2 style="color: #2563eb;">Appointment Reminder</h2>
          <p>Hi <strong>${appointment.patientName}</strong>,</p>
          <p>This is a friendly reminder that your appointment with 
             <span style="color: #2563eb; font-weight: bold;">Dr. ${appointment.doctorName}</span> 
             is scheduled in <strong>${label}</strong>.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;">📅 <strong>Date:</strong> ${appointment.date}</p>
            <p style="margin: 5px 0;">⏰ <strong>Time:</strong> ${appointment.time}</p>
          </div>

          ${appointment.videoUrl ? `
            <p>Your video consultation link is ready:</p>
            <a href="${appointment.videoUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Join Video Call</a>
          ` : ''}

          <p style="color: #64748b; font-size: 0.875rem; margin-top: 30px;">
            If you need to cancel or reschedule, please do so via the NexusHealth dashboard.
          </p>
        </div>
      `
    });
    console.log(`📧 Reminder email (${type}) sent to: ${appointment.patientEmail}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send reminder email:`, err.message);
    return false;
  }
};

/**
 * Sends a confirmation email to a patient.
 * @param {Object} appointment - The appointment document/payload
 */
const sendConfirmationEmail = async (appointment) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Mailer: EMAIL_USER or EMAIL_PASS not set. Skipping email.');
    return;
  }

  try {
    await transporter.sendMail({
      from: `"NexusHealth Confirmed" <${process.env.EMAIL_USER}>`,
      to: appointment.patientEmail,
      subject: `Appointment Confirmed — Dr. ${appointment.doctorName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #059669;">Appointment Confirmed!</h2>
          <p>Hi <strong>${appointment.patientName}</strong>,</p>
          <p>Your appointment with 
             <span style="color: #2563eb; font-weight: bold;">Dr. ${appointment.doctorName}</span> 
             has been successfully confirmed.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;">📅 <strong>Date:</strong> ${appointment.date}</p>
            <p style="margin: 5px 0;">⏰ <strong>Time:</strong> ${appointment.time}</p>
          </div>

          ${appointment.videoUrl ? `
            <p>Your video consultation link is ready:</p>
            <a href="${appointment.videoUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Join Video Consultation</a>
          ` : ''}

          <p style="color: #64748b; font-size: 0.875rem; margin-top: 30px;">
            If you need to cancel, please do so via the NexusHealth dashboard.
          </p>
        </div>
      `
    });
    console.log(`📧 Confirmation email sent to: ${appointment.patientEmail}`);
  } catch (err) {
    console.error(`❌ Failed to send confirmation email:`, err.message);
  }
};

module.exports = { sendReminderEmail, sendConfirmationEmail };
