const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/authMiddleware');
const { internalOnly } = require('../middleware/internalAuth');

// Service-to-service only: this creates notifications for arbitrary users.
router.post('/events', internalOnly, notificationController.handleEvent);
router.get('/my', authenticate, notificationController.getMyNotifications);
router.patch('/mark-all-read', authenticate, notificationController.markAllAsRead);
router.patch('/:id/read', authenticate, notificationController.markAsRead);

module.exports = router;