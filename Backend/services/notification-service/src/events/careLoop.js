const { getIO } = require('../socket');

/**
 * Handles post-consultation workflow based on Daily.co events.
 */
const handleMeetingEnd = async (appointmentId, _duration) => {
  console.log(`🎬 Processing post-consultation loop for: ${appointmentId}`);
  
  // In a real app, you'd fetch the appointment data here.
  // For this design, we trigger the key actions:
  
  const io = getIO();
  
  // 1. Notify patient that summary is being generated
  io.to(`waiting_room_${appointmentId}`).emit('meeting_summary_status', {
    status: 'generating',
    message: 'Preparing your consultation summary...'
  });

  // 2. Simulate delay for PDF/Record generation
  setTimeout(async () => {
    io.to(`waiting_room_${appointmentId}`).emit('meeting_summary_status', {
      status: 'ready',
      message: 'Consultation summary is now available in your records.'
    });
    
    // 3. Trigger Kafka event for follow-up scheduling (Audit Service will also log this)
    // We would use a producer here to emit 'appointment.completed'
  }, 5000);
};

module.exports = { handleMeetingEnd };
