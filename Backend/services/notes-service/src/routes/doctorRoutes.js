const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticate, authorizeRole } = require('../middleware/authMiddleware');

router.use(authenticate);

// Role-based rule: only a clinician may register a doctor record.
router.post('/', authorizeRole('doctor'), doctorController.createDoctor);
router.get('/', doctorController.getDoctors);

module.exports = router;
