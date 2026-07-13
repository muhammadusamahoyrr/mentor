const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')
);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Only formats a medical vault has any business holding.
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'text/plain',
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),

  filename: (req, file, cb) => {
    // Never trust the client's filename on disk. It may contain "../", a null
    // byte, or a name that collides with someone else's file. The original name
    // is kept in Mongo for display; on disk the file gets an opaque random one.
    const ext = path.extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '');
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      // Reported to the client as a 415 by the handler below.
      const err = new Error(`Unsupported file type: ${file.mimetype}`);
      err.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

// Turn multer's errors into the HTTP responses the API promises, instead of
// letting them fall through as a generic 500.
const handleUploadErrors = (err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File is larger than the 10 MB limit' });
  }
  if (err?.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(415).json({ message: err.message });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
};

module.exports = { upload, handleUploadErrors, UPLOAD_DIR, MAX_BYTES, ALLOWED_MIME };
