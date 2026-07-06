const mongoose = require('mongoose');

const outboxSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
  error: { type: String },
  retryCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Outbox', outboxSchema);
