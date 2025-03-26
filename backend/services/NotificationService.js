const BaseService = require('./BaseService');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');

class NotificationService extends BaseService {
  constructor() {
    super(Notification);
  }

  async createNotification(data) {
    // Validate notification type
    const validTypes = [
      'emergency_created',
      'emergency_updated',
      'emergency_resolved',
      'resource_matched',
      'match_accepted',
      'match_rejected',
      'assignment',
      'system'
    ];

    if (!validTypes.includes(data.type)) {
      throw new AppError('Invalid notification type', 400);
    }

    // Set default priority if not provided
    if (!data.priority) {
      data.priority = this.calculatePriority(data);
    }

    const notification = await this.create(data);
    return notification;
  }

  async getUserNotifications(userId, query = {}) {
    const { page = 1, limit = 10, read } = query;

    const filter = { user: userId };
    if (typeof read === 'boolean') {
      filter.read = read;
    }

    return this.getAll(filter, {
      page,
      limit,
      sort: '-createdAt',
      populate: [
        { path: 'emergency', select: 'title type status urgency' },
        { path: 'resource', select: 'title type status' }
      ]
    });
  }

  async markAsRead(notificationId, userId) {
    const notification = await this.getById(notificationId);

    // Check if notification belongs to user
    if (notification.user.toString() !== userId) {
      throw new AppError('Not authorized to update this notification', 403);
    }

    notification.read = true;
    await notification.save();

    return notification;
  }

  async markAllAsRead(userId) {
    await this.model.updateMany(
      { user: userId, read: false },
      { read: true }
    );

    return { success: true };
  }

  async deleteOldNotifications(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.model.deleteMany({
      createdAt: { $lt: cutoffDate },
      read: true
    });

    return {
      success: true,
      deleted: result.deletedCount
    };
  }

  async getUnreadCount(userId) {
    const count = await this.model.countDocuments({
      user: userId,
      read: false
    });

    return { count };
  }

  private calculatePriority(notification) {
    // Calculate priority based on notification type and context
    switch (notification.type) {
      case 'emergency_created':
        return notification.emergency?.urgency === 'critical' ? 'high' : 'normal';
      case 'match_accepted':
        return 'high';
      case 'assignment':
        return notification.emergency?.urgency === 'critical' ? 'high' : 'normal';
      default:
        return 'normal';
    }
  }
}

module.exports = new NotificationService(); 