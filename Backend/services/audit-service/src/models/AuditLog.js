const mongoose = require('mongoose');

/**
 * Immutable audit log schema.
 * Stores every event published across the system for legal compliance.
 */
const auditLogSchema = new mongoose.Schema({
  topic: { type: String, required: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  eventHash: { type: String }, // To be implemented for tamper-proofing
  metadata: {
    service: String,
    partition: Number,
    offset: String
  }
}, { 
  timestamps: false, // Use our own timestamp
  capped: false // Can be made capped for performance if historical data isn't needed forever
});

// Prevent any updates or deletes (soft immutability at application level)
auditLogSchema.pre('save', async function() {
  if (!this.isNew) {
    throw new Error('Audit logs are immutable and cannot be updated.');
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
