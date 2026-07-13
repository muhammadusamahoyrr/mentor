const { AppError } = require('../../../../shared/middleware/errorHandler');

/**
 * Simple validation middleware to ensure required fields are present and valid.
 */
const validate = (schema) => (req, res, next) => {
  const errors = [];
  const body = req.body;

  Object.keys(schema).forEach(field => {
    const rules = schema[field];
    const value = body[field];

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
    } else if (value !== undefined) {
      if (rules.type === 'date' && isNaN(Date.parse(value))) {
        errors.push(`${field} must be a valid date`);
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }
    }
  });

  if (errors.length > 0) {
    return next(new AppError(errors.join(', '), 400));
  }

  next();
};

const appointmentSchemas = {
  create: {
    doctorId: { required: true },
    date: { required: true, type: 'date' },
    time: { required: true },
    reason: { required: true }
  },
  updateStatus: {
    status: { required: true, enum: ['pending', 'confirmed', 'cancelled', 'completed'] }
  }
};

module.exports = { validate, appointmentSchemas };
