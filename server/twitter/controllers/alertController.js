const Alert = require('../models/Alert');
const MonitoredAccount = require('../models/MonitoredAccount');
const alertService = require('../services/alertService');
const logger = require('../config/logger');

// @desc    Get all alerts with filters
// @route   GET /api/alerts
const getAlerts = async (req, res, next) => {
  try {
    const { page, limit, activityType, username, platform, isRead, isViewed } = req.query;

    const result = await alertService.getAlerts({
      page: page || 1,
      limit: limit || 20,
      activityType,
      username,
      platform,
      isRead,
      isViewed,
    });

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single alert
// @route   GET /api/alerts/:id
const getAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id).lean();
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    res.status(200).json({ success: true, alert: alertService.normalizeAlert(alert) });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark alerts as read
// @route   PUT /api/alerts/mark-read
const markRead = async (req, res, next) => {
  try {
    const { alertIds } = req.body;
    await alertService.markAlertsViewed(alertIds);
    res.status(200).json({ success: true, message: 'Alerts marked as viewed' });
  } catch (error) {
    next(error);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    await Alert.updateMany({}, { $set: { isRead: true, isViewed: true } });
    res.status(200).json({ success: true, message: 'All alerts marked as read' });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark single alert as viewed
// @route   PUT /api/alerts/:id/viewed
const markOneViewed = async (req, res, next) => {
  try {
    const alert = await alertService.markAlertViewed(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Alert marked as viewed',
      alert: alertService.normalizeAlert(alert),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread alert count
// @route   GET /api/alerts/unread-count
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await alertService.getUnreadCount();
    res.status(200).json({ success: true, count });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an alert
// @route   DELETE /api/alerts/:id
const deleteAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    res.status(200).json({ success: true, message: 'Alert deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete all alerts
// @route   DELETE /api/alerts
const deleteAllAlerts = async (req, res, next) => {
  try {
    await Alert.deleteMany({});
    await MonitoredAccount.updateMany({}, { $set: { alertCount: 0 } });
    res.status(200).json({ success: true, message: 'All alerts cleared' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard stats
// @route   GET /api/alerts/stats
const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalAlerts,
      unreadAlerts,
      totalAccounts,
      activeAccounts,
      recentAlerts,
      activityBreakdown,
    ] = await Promise.all([
      Alert.countDocuments(),
      Alert.countDocuments({
        $or: [
          { isViewed: false },
          { isViewed: { $exists: false }, isRead: false },
          { isViewed: { $exists: false }, isRead: { $exists: false } },
        ],
      }),
      MonitoredAccount.countDocuments(),
      MonitoredAccount.countDocuments({ monitoringStatus: 'active' }),
      Alert.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Alert.aggregate([
        { $group: { _id: '$activityType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    // Alerts per day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const alertsPerDay = await Alert.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalAlerts,
        unreadAlerts,
        totalAccounts,
        activeAccounts,
        recentAlerts,
        activityBreakdown,
        alertsPerDay,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAlerts,
  getAlert,
  markRead,
  markAllRead,
  markOneViewed,
  getUnreadCount,
  deleteAlert,
  deleteAllAlerts,
  getDashboardStats,
};
