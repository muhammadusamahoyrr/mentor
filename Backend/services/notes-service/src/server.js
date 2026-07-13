require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const noteRoutes = require('./routes/noteRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:3000'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Root route — lists the available endpoints so hitting "/" isn't a dead end.
app.get('/', (req, res) =>
  res.json({
    service: 'notes-service',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      doctors: ['POST /api/doctors', 'GET /api/doctors'],
      notes: [
        'POST /api/notes',
        'GET /api/notes?appointmentId=',
        'GET /api/notes?doctorId=',
        'GET /api/notes/:id',
        'PUT /api/notes/:id',
        'DELETE /api/notes/:id',
      ],
      note: 'All /api routes require the auth-service JWT (cookie or bearer).',
    },
  })
);

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'notes' }));
app.use('/api/doctors', doctorRoutes);
app.use('/api/notes', noteRoutes);

// Central error handler — must be registered last.
app.use(errorHandler);

const PORT = process.env.PORT || 3006;

// Only start listening when run directly (so tests can import `app` without a live port).
if (require.main === module) {
  app.listen(PORT, () => console.log(`Notes service running on port ${PORT}`));
}

module.exports = app;
