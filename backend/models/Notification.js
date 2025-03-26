const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'emergency_created',
        'emergency_updated',
        'emergency_resolved',
        'resource_matched',
        'match_accepted',
        'match_rejected',
        'assignment',
        'system'
      ]
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters']
    },
    message: {
      type: String,
      required: true,
      maxlength: [500, 'Message cannot be more than 500 characters']
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    emergency: {
      type: mongoose.Schema.ObjectId,
      ref: 'Emergency'
    },
    resource: {
      type: mongoose.Schema.ObjectId,
      ref: 'Resource'
    },
    read: {
      type: Boolean,
      default: false
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal'
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    },
    expiresAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Index for querying user's notifications and cleanup
NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ read: 1, createdAt: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Middleware to set expiration date for certain notification types
NotificationSchema.pre('save', function(next) {
  if (!this.expiresAt) {
    const expirationDays = {
      emergency_resolved: 7,
      match_accepted: 30,
      match_rejected: 7,
      system: 30
    };

    if (expirationDays[this.type]) {
      this.expiresAt = new Date(
        Date.now() + expirationDays[this.type] * 24 * 60 * 60 * 1000
      );
    }
  }
  next();
});

module.exports = mongoose.model('Notification', NotificationSchema);