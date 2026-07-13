require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const fileRoutes = require('./routes/fileRoutes');

const app = express();
connectDB();

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Request Logger for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api/files', fileRoutes);
app.get('/health', (req, res) => res.json({status:'healthy', service:'file'}));

// Centralized Error Handling
const { errorHandler } = require('../../../shared/middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`File Service running on ${PORT}`));

module.exports = app;
