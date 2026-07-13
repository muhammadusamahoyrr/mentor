const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/', doctorController.createDoctor);
router.get('/', doctorController.getDoctors);

module.exports = router;
