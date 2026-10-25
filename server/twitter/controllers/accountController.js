const MonitoredAccount = require('../models/MonitoredAccount');
const Alert = require('../models/Alert');
const twitterService = require('../services/twitterService');
const logger = require('../config/logger');

// @desc    Add a Twitter account to monitor
// @route   POST /api/accounts
const addAccount = async (req, res, next) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Twitter username is required',
      });
    }

    const cleanUsername = username.replace('@', '').trim().toLowerCase();

    // Check if already monitored
    const existing = await MonitoredAccount.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `@${cleanUsername} is already being monitored`,
      });
    }

    // Fetch profile from Twitter
    let profile;
    try {
      profile = await twitterService.getUserProfile(cleanUsername);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: `Could not find Twitter user @${cleanUsername}: ${error.message}`,
      });
    }

    const account = await MonitoredAccount.create({
      ...profile,
      monitoringStatus: 'active',
    });

    logger.info(`Account added for monitoring: @${cleanUsername}`);

    res.status(201).json({
      success: true,
      message: `@${cleanUsername} added to monitoring`,
      account,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all monitored accounts
// @route   GET /api/accounts
const getAccounts = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.monitoringStatus = status;

    const [accounts, total] = await Promise.all([
      MonitoredAccount.find(query)
        .sort({ createdAt: -1 })
        .lean(),
      MonitoredAccount.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      accounts,
      pagination: {
        total,
        page: 1,
        pages: 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single monitored account
// @route   GET /api/accounts/:id
const getAccount = async (req, res, next) => {
  try {
    const account = await MonitoredAccount.findById(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
      });
    }

    res.status(200).json({ success: true, account });
  } catch (error) {
    next(error);
  }
};

// @desc    Update monitoring status
// @route   PUT /api/accounts/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['active', 'paused'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be active or paused',
      });
    }

    const account = await MonitoredAccount.findByIdAndUpdate(
      req.params.id,
      { monitoringStatus: status },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    logger.info(`Account @${account.username} monitoring status set to: ${status}`);

    res.status(200).json({
      success: true,
      message: `Monitoring ${status} for @${account.username}`,
      account,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh account profile data
// @route   PUT /api/accounts/:id/refresh
const refreshAccount = async (req, res, next) => {
  try {
    const account = await MonitoredAccount.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const profile = await twitterService.getUserProfile(account.username);

    const updated = await MonitoredAccount.findByIdAndUpdate(
      req.params.id,
      {
        displayName: profile.displayName,
        profileImage: profile.profileImage,
        bio: profile.bio,
        followers: profile.followers,
        following: profile.following,
        tweetsCount: profile.tweetsCount,
        verified: profile.verified,
        location: profile.location,
        website: profile.website,
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile refreshed',
      account: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove a monitored account
// @route   DELETE /api/accounts/:id
const removeAccount = async (req, res, next) => {
  try {
    const account = await MonitoredAccount.findById(req.params.id);

    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    await MonitoredAccount.findByIdAndDelete(req.params.id);
    await Alert.deleteMany({
      $or: [
        { accountId: account._id },
        { username: account.username },
      ],
    });

    logger.info(`Account removed from monitoring: @${account.username}`);

    res.status(200).json({
      success: true,
      message: `@${account.username} removed from monitoring`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get account activity stats
// @route   GET /api/accounts/:id/stats
const getAccountStats = async (req, res, next) => {
  try {
    const account = await MonitoredAccount.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const activityBreakdown = await Alert.aggregate([
      { $match: { accountId: account._id } },
      { $group: { _id: '$activityType', count: { $sum: 1 } } },
    ]);

    const recentAlerts = await Alert.find({ accountId: account._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.status(200).json({
      success: true,
      stats: {
        totalAlerts: account.alertCount,
        activityBreakdown,
        recentAlerts,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addAccount,
  getAccounts,
  getAccount,
  updateStatus,
  refreshAccount,
  removeAccount,
  getAccountStats,
};
