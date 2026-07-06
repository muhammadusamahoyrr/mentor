const Notification = require('../models/Notification');
const { processNotificationEvent } = require('../services/eventProcessor');
const { asyncHandler, AppError } = require('../../../../shared/middleware/errorHandler');

exports.handleEvent = asyncHandler(async (req, res, next) => {
  const { event, topic } = req.body;
  if (!event || !topic) {
    return next(new AppError('topic and event are required', 400));
  }

  await processNotificationEvent(topic, event);
  res.json({ success: true });
});

exports.getMyNotifications = asyncHandler(async (req, res, next) => {
  const userId = req.user.id?.toString?.() ?? req.user.id;
  const notifs = await Notification.find({ userId }).sort({ createdAt: -1 });
  res.json(notifs);
});

exports.markAsRead = asyncHandler(async (req, res, next) => {
  const userId = req.user.id?.toString?.() ?? req.user.id;
  const notif = await Notification.findById(req.params.id);
  if (!notif) {
    return next(new AppError('Notification not found', 404));
  }
  if (notif.userId !== userId) {
    return next(new AppError('Not authorized to access this notification', 403));
  }

  notif.read = true;
  await notif.save();
  res.json(notif);
});

exports.markAllAsRead = asyncHandler(async (req, res, next) => {
  const userId = req.user.id?.toString?.() ?? req.user.id;
  await Notification.updateMany(
    { userId, read: false },
    { $set: { read: true } }
  );
  res.json({ success: true, message: 'All notifications marked as read' });
});
