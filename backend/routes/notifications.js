const express = require('express');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
  deleteOldNotifications
} = require('../controllers/notificationController');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Protected routes
router.use(protect);

router.get('/', getNotifications);
router.get('/unread/count', getUnreadCount);
router.put('/:id/read', markAsRead);
router.put('/read/all', markAllAsRead);

// Admin only routes
router.use(authorize('admin'));

router.post('/', createNotification);
router.delete('/cleanup', deleteOldNotifications);

module.exports = router; 