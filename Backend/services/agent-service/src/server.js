require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const agentRoutes = require('./routes/agentRoutes');
const { errorHandler } = require('../../../shared/middleware/errorHandler');

const app = express();

const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:3000'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Root route — lists the available endpoints so hitting "/" isn't a dead end.
app.get('/', (req, res) =>
  res.json({
    service: 'agent-service',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      ask: 'POST /api/agent/ask   (doctor JWT; body: { question, sessionId? })',
      note: 'All /api routes require the auth-service JWT (cookie or bearer).',
    },
  })
);

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'agent' }));
app.use('/api/agent', agentRoutes);

// Central error handler — must be registered last.
app.use(errorHandler);

const PORT = process.env.PORT || 3007;

// Only listen when run directly, so tests can import `app` without a live port.
if (require.main === module) {
  app.listen(PORT, () => console.log(`Agent service running on port ${PORT}`));
}

module.exports = app;
