require('dotenv').config();
const express = require('express');
const cors = require('cors');
const noteRoutes = require('./routes/noteRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

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
        'GET /api/notes',
        'GET /api/notes/:id',
        'PUT /api/notes/:id',
        'DELETE /api/notes/:id',
      ],
    },
  })
);

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'notes' }));
app.use('/api/doctors', doctorRoutes);
app.use('/api/notes', noteRoutes);

// Central error handler — must be registered last.
app.use(errorHandler);

const PORT = process.env.PORT || 3005;

// Only start listening when run directly (so tests can import `app` without a live port).
if (require.main === module) {
  app.listen(PORT, () => console.log(`Notes service running on port ${PORT}`));
}

module.exports = app;
