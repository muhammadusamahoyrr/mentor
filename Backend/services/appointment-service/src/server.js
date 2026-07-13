require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const appointmentRoutes = require('./routes/appointmentRoutes');
const { connectProducer } = require('./events/appointmentProducer');
const { startOutboxRelay } = require('./events/outboxRelay');
const { runDoctorCacheConsumer } = require('./events/doctorCacheConsumer');

const app = express();
connectDB();

// The relay must run whether or not Kafka is reachable: draining the outbox via
// the HTTP fallback is precisely what it is for. Starting it inside .then() meant
// a dead broker left every event stranded as 'pending' forever.
connectProducer()
  .then(() => console.log('✅ Appointment producer connected'))
  .catch(err => console.error('Kafka producer failed (outbox will fall back to HTTP):', err.message))
  .finally(() => startOutboxRelay());

// Start local cache consumer to solve cascading failure risk
runDoctorCacheConsumer();

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/appointments', appointmentRoutes);
app.get('/health', (req, res) => res.json({status:'healthy', service:'appointment'}));

// Centralized Error Handling
const { errorHandler } = require('../../../shared/middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Appointment Service running on ${PORT}`));

module.exports = app;
