const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { authenticate, authorizeRole } = require('../middleware/authMiddleware');

// Upload file (patient only)
router.post('/', authenticate, authorizeRole('patient'), fileController.uploadFile);

// Get files for current user
router.get('/my', authenticate, fileController.getMyFiles);

// Get single file by ID
router.get('/:id', authenticate, fileController.getFileById);

// Toggle share with doctor
router.patch('/:id/share', authenticate, authorizeRole('patient'), fileController.toggleShare);

// Add doctor comments (doctor only)
router.patch('/:id/comments', authenticate, authorizeRole('doctor'), fileController.addDoctorComments);
router.post('/:id/comments', authenticate, authorizeRole('doctor'), fileController.addDoctorComments);

// Delete file
router.delete('/:id', authenticate, fileController.deleteFile);

module.exports = router;
