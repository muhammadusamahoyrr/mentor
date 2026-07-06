// Operational error with an HTTP status code attached.
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Wraps async route handlers so thrown/rejected errors reach the error middleware.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Central error handler — maps errors (including common Prisma codes) to HTTP responses.
const errorHandler = (err, req, res, _next) => {
  // Prisma: unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'A record with that value already exists' });
  }
  // Prisma: record required by an operation was not found
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
};

module.exports = { AppError, asyncHandler, errorHandler };
