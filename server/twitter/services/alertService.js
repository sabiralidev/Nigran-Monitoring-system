const Alert = require('../models/Alert');
const MonitoredAccount = require('../models/MonitoredAccount');
const logger = require('../config/logger');

let io = null;

const setSocketInstance = (socketIo) => {
  io = socketIo;
};

const normalizeAlert = (alert) => {
  if (!alert) return null;

  const createdAt = alert.sourceCreatedAt || alert.tweetCreatedAt || alert.createdAt;
  const sourceUrl = alert.sourceUrl || alert.tweetUrl || '';

  return {
    ...alert,
    platform: alert.platform || 'twitter',
    externalId: alert.externalId || alert.tweetId || alert._id?.toString(),
    sourceUrl,
    isViewed: typeof alert.isViewed === 'boolean' ? alert.isViewed : !!alert.isRead,
    createdAt,
  };
};

const buildViewedFilter = (isViewed) => {
  if (isViewed === undefined || isViewed === null) return null;

  const viewed = isViewed === true || isViewed === 'true';

  if (viewed) {
    return {
      $or: [
        { isViewed: true },
        { isViewed: { $exists: false }, isRead: true },
      ],
    };
  }

  return {
    $or: [
      { isViewed: false },
      { isViewed: { $exists: false }, isRead: false },
      { isViewed: { $exists: false }, isRead: { $exists: false } },
    ],
  };
};

// Create a new alert and emit via socket
const createAlert = async (alertData) => {
  try {
    const platform = (alertData.platform || 'twitter').toLowerCase();
    const externalId = alertData.externalId || alertData.tweetId;

    if (!externalId) {
      logger.warn('Skipped alert creation because externalId/tweetId is missing');
      return null;
    }

    // Check for duplicate alert by (platform, externalId)
    const existing = await Alert.findOne({ platform, externalId });
    if (existing) {
      return null; // Duplicate - skip
    }

    const payload = {
      ...alertData,
      platform,
      externalId,
      tweetId: alertData.tweetId || externalId,
      sourceUrl: alertData.sourceUrl || alertData.tweetUrl || '',
      tweetUrl: alertData.tweetUrl || alertData.sourceUrl || '',
      sourceCreatedAt: alertData.sourceCreatedAt || alertData.tweetCreatedAt || new Date(),
      tweetCreatedAt: alertData.tweetCreatedAt || alertData.sourceCreatedAt || new Date(),
      isRead: false,
      isViewed: false,
    };

    const alert = await Alert.create(payload);

    // Increment alert count on monitored account
    if (alertData.accountId) {
      await MonitoredAccount.findByIdAndUpdate(alertData.accountId, {
        $inc: { alertCount: 1 },
      });
    }

    // Populate and emit via socket
    const populated = normalizeAlert((await Alert.findById(alert._id).lean()) || alert.toObject());

    if (io) {
      io.emit('new_alert', {
        alert: populated,
        message: `[${platform}] @${alertData.username} posted a new ${alertData.activityType}`,
      });
      logger.info(`Socket alert emitted for @${alertData.username} on ${platform} - ${alertData.activityType}`);
    }

    return populated;
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate tweetId - silently skip
      return null;
    }
    logger.error(`Error creating alert: ${error.message}`);
    throw error;
  }
};

// Get alerts with pagination and filters
const getAlerts = async ({ page = 1, limit = 20, activityType, username, platform, isRead, isViewed }) => {
  const query = {};

  const parsedPage = Number.parseInt(page, 10);
  const parsedLimit = Number.parseInt(limit, 10);
  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 100)
    : 20;

  if (activityType) query.activityType = activityType;
  if (username) query.username = username.toLowerCase();
  if (platform) query.platform = platform.toLowerCase();

  const viewedFilter = buildViewedFilter(isViewed !== undefined ? isViewed : isRead);
  if (viewedFilter) {
    Object.assign(query, viewedFilter);
  }

  const skip = (safePage - 1) * safeLimit;

  const [alerts, total] = await Promise.all([
    Alert.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Alert.countDocuments(query),
  ]);

  const normalizedAlerts = alerts.map(normalizeAlert);
  const pages = Math.max(1, Math.ceil(total / safeLimit));

  return {
    alerts: normalizedAlerts,
    pagination: {
      total,
      page: safePage,
      pages,
      limit: safeLimit,
      hasMore: safePage < pages,
    },
  };
};

// Mark alerts as viewed
const markAlertsViewed = async (alertIds) => {
  if (alertIds && alertIds.length > 0) {
    await Alert.updateMany(
      { _id: { $in: alertIds } },
      { $set: { isRead: true, isViewed: true } }
    );
  } else {
    await Alert.updateMany({}, { $set: { isRead: true, isViewed: true } });
  }
};

const markAlertViewed = async (alertId) => {
  return Alert.findByIdAndUpdate(
    alertId,
    { $set: { isRead: true, isViewed: true } },
    { new: true }
  ).lean();
};

// Get unread count
const getUnreadCount = async () => {
  return Alert.countDocuments({
    $or: [
      { isViewed: false },
      { isViewed: { $exists: false }, isRead: false },
      { isViewed: { $exists: false }, isRead: { $exists: false } },
    ],
  });
};

module.exports = {
  setSocketInstance,
  createAlert,
  getAlerts,
  markAlertsRead: markAlertsViewed,
  markAlertsViewed,
  markAlertViewed,
  normalizeAlert,
  getUnreadCount,
};
