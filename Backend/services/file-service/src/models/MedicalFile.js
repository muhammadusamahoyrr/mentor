const mongoose = require('mongoose');

const medicalFileSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  patientName: { type: String, required: true },
  patientEmail: { type: String, required: true },
  
  doctorId: { type: String, default: null },
  doctorName: { type: String, default: null },
  
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileSizeFormatted: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['Prescription', 'Lab Result', 'Scan'],
    required: true 
  },
  mimeType: { type: String, required: true },

  // The opaque name of the real file on disk. Never exposed to the client and
  // never derived from the user's filename — bytes are served through
  // GET /api/files/:id/content, which checks permissions first.
  storageKey: { type: String, required: true },

  // Legacy: earlier uploads stored a fabricated '/mock-vault/...' path here and
  // no bytes at all. Kept nullable so those rows still load; new uploads don't
  // set it.
  fileUrl: { type: String, default: null },


  sharedWithDoctor: { type: Boolean, default: false },
  doctorComments: { type: String, default: null },
  
  uploadedAt: { type: Date, default: Date.now },
  sharedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('MedicalFile', medicalFileSchema);
