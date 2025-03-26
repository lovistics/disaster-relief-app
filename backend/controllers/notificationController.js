const asyncHandler = require('express-async-handler');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const NotificationService = require('../services/NotificationService');

// @desc    Get user notifications
// @route   GET /api/v1/notifications
// @access  Private
exports.getNotifications = asyncHandler(async (req, res) => {
  const result = await NotificationService.getUserNotifications(req.user.id, req.query);

  res.json({
    success: true,
    ...result
  });
});

// @desc    Get unread notification count
// @route   GET /api/v1/notifications/unread/count
// @access  Private
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const result = await NotificationService.getUnreadCount(req.user.id);

  res.json({
    success: true,
    data: result
  });
});

// @desc    Mark notification as read
// @route   PUT /api/v1/notifications/:id/read
// @access  Private
exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await NotificationService.markAsRead(req.params.id, req.user.id);

  res.json({
    success: true,
    data: notification
  });
});

// @desc    Mark all notifications as read
// @route   PUT /api/v1/notifications/read/all
// @access  Private
exports.markAllAsRead = asyncHandler(async (req, res) => {
  const result = await NotificationService.markAllAsRead(req.user.id);

  res.json({
    success: true,
    data: result
  });
});

// @desc    Create notification (Admin/System only)
// @route   POST /api/v1/notifications
// @access  Private/Admin
exports.createNotification = [
  validate([
    body('type')
      .isIn([
        'emergency_created',
        'emergency_updated',
        'emergency_resolved',
        'resource_matched',
        'match_accepted',
        'match_rejected',
        'assignment',
        'system'
      ])
      .withMessage('Invalid notification type'),
    body('title')
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('Title must be between 3 and 100 characters'),
    body('message')
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Message must be between 10 and 500 characters'),
    body('user')
      .isMongoId()
      .withMessage('Invalid user ID'),
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high'])
      .withMessage('Invalid priority level')
  ]),
  asyncHandler(async (req, res) => {
    const notification = await NotificationService.createNotification(req.body);

    res.status(201).json({
      success: true,
      data: notification
    });
  })
];

// @desc    Delete old notifications (Admin only)
// @route   DELETE /api/v1/notifications/cleanup
// @access  Private/Admin
exports.deleteOldNotifications = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const result = await NotificationService.deleteOldNotifications(parseInt(days));

  res.json({
    success: true,
    data: result
  });
}); 