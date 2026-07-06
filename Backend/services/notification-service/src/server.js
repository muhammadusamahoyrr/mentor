const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const connectDB = require('./config/db');
const notificationRoutes = require('./routes/notificationRoutes');
const { init, notifyUser } = require('./socket');

const { runConsumer } = require('./events/notificationConsumer');

const app = express();
connectDB();
require('./cron/reminderJob');

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/api/notifications', notificationRoutes);

// Centralized Error Handling
const { errorHandler } = require('../../../shared/middleware/errorHandler');
app.use(errorHandler);

const server = http.createServer(app);
init(server);

runConsumer(notifyUser).catch(err => console.error('Kafka consumer failed:', err));

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'notification' }));

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`Notification Service running on ${PORT}`);
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('✅ Email reminders configured');
  } else {
    console.warn('⚠️  EMAIL_USER / EMAIL_PASS not set — in-app reminders work, emails are skipped');
  }
});

module.exports = app;
