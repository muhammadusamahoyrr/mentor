const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { authenticate, authorizeRole } = require('../middleware/authMiddleware');
const { upload, handleUploadErrors } = require('../middleware/upload');

// Upload file (patient only) — multipart/form-data with the real bytes in "file".
router.post(
  '/',
  authenticate,
  authorizeRole('patient'),
  upload.single('file'),
  handleUploadErrors,
  fileController.uploadFile
);

// Get files for current user
router.get('/my', authenticate, fileController.getMyFiles);

// Download the actual bytes — permission-checked, no public URL.
// Declared before '/:id' so it isn't swallowed by it.
router.get('/:id/content', authenticate, fileController.downloadFile);

// Get single file by ID (metadata)
router.get('/:id', authenticate, fileController.getFileById);

// Toggle share with doctor
router.patch('/:id/share', authenticate, authorizeRole('patient'), fileController.toggleShare);

// Add doctor comments (doctor only)
router.patch('/:id/comments', authenticate, authorizeRole('doctor'), fileController.addDoctorComments);
router.post('/:id/comments', authenticate, authorizeRole('doctor'), fileController.addDoctorComments);

// Delete file
router.delete('/:id', authenticate, fileController.deleteFile);

module.exports = router;
