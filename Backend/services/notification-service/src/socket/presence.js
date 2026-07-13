const redisCache = require('../../../../shared/events/redisClient');

/**
 * Updates doctor presence and notifies waiting patients.
 */
const updateDoctorStatus = async (io, doctorId, status) => {
  const ttl = 300; // 5 minute heartbeat

  if (status === 'offline') {
    await redisCache.deleteTempToken('presence', doctorId);
  } else {
    // Use tempToken logic as a generic store (falls back to in-memory if Redis is down)
    await redisCache.setTempToken('presence', doctorId, status, ttl);
  }

  if (io) {
    io.to(`doctor_status_${doctorId}`).emit('status_update', { doctorId, status });
  }
};

/**
 * Tracks patients in a virtual waiting room for a specific doctor.
 */
const manageWaitingRoom = (io, socket) => {
  socket.on('join_waiting_room', async ({ doctorId, appointmentId }) => {
    socket.join(`doctor_status_${doctorId}`);
    if (appointmentId) socket.join(`waiting_room_${appointmentId}`);

    // Get status from our resilient cache
    const status = await redisCache.getTempToken('presence', doctorId) || 'offline';
    socket.emit('status_update', { doctorId, status });

    console.log(`👤 Patient joined waiting room for doctor: ${doctorId}`);
  });

  socket.on('doctor_heartbeat', async ({ status }) => {
    if (socket.userId && socket.userRole === 'doctor') {
      await updateDoctorStatus(io, socket.userId, status);
    }
  });
};

module.exports = { updateDoctorStatus, manageWaitingRoom };
