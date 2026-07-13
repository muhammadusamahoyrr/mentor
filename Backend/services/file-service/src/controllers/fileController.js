const MedicalFile = require('../models/MedicalFile');
const axios = require('axios');
const mongoose = require('mongoose');
const { asyncHandler, AppError } = require('../../../../shared/middleware/errorHandler');

// Upload a new file
const uploadFile = asyncHandler(async (req, res, next) => {
  const { fileName, fileSize, fileSizeFormatted, category, mimeType, fileUrl } = req.body;
  
  if (!fileName || !fileSize || !fileSizeFormatted || !category || !mimeType || !fileUrl) {
    return next(new AppError('All fields (fileName, fileSize, fileSizeFormatted, category, mimeType, fileUrl) are required', 400));
  }

  if (!req.user.name || !req.user.email) {
    return next(new AppError('User profile incomplete. Please ensure you are logged in correctly.', 401));
  }

  const newFile = new MedicalFile({
    patientId: req.user.id,
    patientName: req.user.name,
    patientEmail: req.user.email,
    fileName,
    fileSize,
    fileSizeFormatted,
    category,
    mimeType,
    fileUrl,
    sharedWithDoctor: false
  });

  await newFile.save();
  res.status(201).json(newFile);
});

// Get all files for current user (patient or doctor)
const getMyFiles = asyncHandler(async (req, res, next) => {
  let files = [];
  
  if (req.user.role === 'patient') {
    // Patients see their own files
    files = await MedicalFile.find({ patientId: req.user.id }).sort({ uploadedAt: -1 });
  } else if (req.user.role === 'doctor') {
    // Doctors see files shared with them by their patients
    files = await MedicalFile.find({ 
      doctorId: req.user.id,
      sharedWithDoctor: true 
    }).sort({ uploadedAt: -1 });
  }
  
  res.json(files);
});

// Get single file by ID
const getFileById = asyncHandler(async (req, res, next) => {
  const fileId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    return next(new AppError('Invalid file ID format', 400));
  }

  const file = await MedicalFile.findById(fileId);
  if (!file) {
    return next(new AppError('File not found', 404));
  }

  // Permission check
  const isPatientOwner = String(file.patientId) === String(req.user.id);
  const isAssignedDoctor = file.sharedWithDoctor && String(file.doctorId) === String(req.user.id);

  if (!isPatientOwner && !isAssignedDoctor) {
    return next(new AppError('Access denied', 403));
  }

  res.json(file);
});

// Toggle share status with doctor
const toggleShare = asyncHandler(async (req, res, next) => {
  const { doctorId, doctorName } = req.body;
  const fileId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    return next(new AppError('Invalid file ID', 400));
  }
  
  const file = await MedicalFile.findOne({ 
    _id: fileId, 
    patientId: req.user.id 
  });
  
  if (!file) {
    return next(new AppError('File not found', 404));
  }

  // Sharing a medical record is an explicit act: the patient must name the doctor.
  // This used to fall back to "whichever doctor is first in the database" when no
  // doctorId was supplied, silently handing the record to an arbitrary clinician.
  if (file.sharedWithDoctor) {
    // Currently shared -> unshare, and drop the doctor so it doesn't linger.
    file.sharedWithDoctor = false;
    file.doctorId = null;
    file.doctorName = null;
    file.sharedAt = null;
  } else {
    if (!doctorId) {
      return next(new AppError('A doctorId is required to share a file', 400));
    }
    file.doctorId = String(doctorId);
    if (doctorName) file.doctorName = doctorName;
    file.sharedWithDoctor = true;
    file.sharedAt = new Date();
  }

  await file.save();

  // Notify doctor if sharing is enabled
  if (file.sharedWithDoctor && file.doctorId) {
    try {
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/events`,
        {
          topic: 'file.shared',
          event: {
            fileId: file._id,
            fileName: file.fileName,
            doctorId: file.doctorId,
            patientId: file.patientId,
            patientName: file.patientName
          }
        },
        { headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN } }
      );
      console.log(`Notification sent to doctor ${file.doctorId} for file ${file.fileName}`);
    } catch (err) {
      console.error('Failed to send share notification:', err.message);
    }
  }

  res.json(file);
});

// Add doctor comments
const addDoctorComments = asyncHandler(async (req, res, next) => {
  const { comments } = req.body;
  const fileId = req.params.id;
  const doctorId = req.user.id;

  console.log(`💬 Attempting to add comment to file ${fileId} by doctor ${doctorId}`);

  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    return next(new AppError('Invalid file ID format', 400));
  }
  
  // Find the file first without doctorId to give a better error message if it's a permission issue
  const file = await MedicalFile.findById(fileId);
  
  if (!file) {
    const existingFiles = await MedicalFile.find({}).limit(5).select('_id');
    console.warn(`⚠️  File ${fileId} not found in database. Existing IDs:`, existingFiles.map(f => f._id));
    return next(new AppError('File not found', 404));
  }

  // Check if file is shared and if it's shared with THIS doctor
  if (!file.sharedWithDoctor) {
    console.warn(`⚠️  File ${fileId} is not marked as shared`);
    return next(new AppError('Access denied: File is not shared', 403));
  }

  // Use loose equality or normalize both to strings for comparison
  if (String(file.doctorId) !== String(doctorId)) {
    console.warn(`⚠️  Access denied: File ${fileId} is shared with doctor ${file.doctorId}, but request came from ${doctorId}`);
    return next(new AppError('Access denied: You are not the assigned doctor for this file', 403));
  }

  file.doctorComments = comments;
  await file.save();
  
  console.log(`✅ Comment saved for file ${fileId}`);

  // Notify patient about new doctor comment
  try {
    await axios.post(
      `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/events`,
      {
        topic: 'file.comment_added',
        event: {
          fileId: file._id,
          fileName: file.fileName,
          doctorId: file.doctorId,
          doctorName: req.user.name || file.doctorName,
          patientId: file.patientId,
          patientName: file.patientName,
          comments: comments
        }
      },
      { headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN } }
    );
    console.log(`Notification sent to patient ${file.patientId} for file comment on ${file.fileName}`);
  } catch (err) {
    console.error('Failed to send comment notification:', err.message);
  }
  
  res.json(file);
});

// Delete a file
const deleteFile = asyncHandler(async (req, res, next) => {
  const fileId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    return next(new AppError('Invalid file ID', 400));
  }

  const file = await MedicalFile.findOne({ 
    _id: fileId, 
    patientId: req.user.id 
  });
  
  if (!file) {
    return next(new AppError('File not found', 404));
  }

  await MedicalFile.deleteOne({ _id: fileId });
  res.json({ message: 'File deleted successfully' });
});

module.exports = {
  uploadFile,
  getMyFiles,
  getFileById,
  toggleShare,
  addDoctorComments,
  deleteFile
};

