const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticate, authorizeRole } = require('../middleware/authMiddleware');
const { validate, appointmentSchemas } = require('../middleware/validator');

router.post('/', authenticate, authorizeRole('patient'), validate(appointmentSchemas.create), appointmentController.createAppointment);
router.get('/test-token/:roomName', authenticate, async (req, res) => {
  try {
    const { createMeetingToken } = require('../utils/videoRoom');
    const token = await createMeetingToken(req.params.roomName, req.user.role === 'doctor');
    res.json({ roomName: req.params.roomName, token, role: req.user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/my', authenticate, appointmentController.getMyAppointments);
router.get('/:id', authenticate, appointmentController.getAppointmentById);
router.patch('/:id', authenticate, authorizeRole(['doctor', 'patient']), validate(appointmentSchemas.updateStatus), appointmentController.updateAppointmentStatus);
router.delete('/:id', authenticate, appointmentController.deleteAppointment);

// Appointment -> Notes (one-to-many relationship)
router.post('/:id/notes', authenticate, appointmentController.addNote);
router.get('/:id/notes', authenticate, appointmentController.getAppointmentNotes);

module.exports = router;