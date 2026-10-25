const MonitoredAccount = require('../models/MonitoredAccount');
const Alert = require('../models/Alert');
const { getChannelUploadsPlaylist } = require('../services/youtubeService');

/**
 * Add a new YouTube channel to monitor
 * POST /channels
 */
exports.addChannel = async (req, res) => {
  const { channelId } = req.body;

  if (!channelId || channelId.trim() === '') {
    return res.status(400).json({ msg: 'Please provide a valid YouTube Channel ID' });
  }

  try {
    // Check if channel already exists
    let account = await MonitoredAccount.findOne({
      channelId,
      platform: 'youtube',
    });

    if (account) {
      return res.status(400).json({ msg: 'Channel is already being monitored' });
    }

    // Fetch channel details from YouTube API
    let channelDetails;
    try {
      channelDetails = await getChannelUploadsPlaylist(channelId);
    } catch (error) {
      return res.status(400).json({ msg: 'Invalid Channel ID or API error. Please check your YouTube API key.' });
    }

    // Create new monitored account
    account = new MonitoredAccount({
      channelId,
      channelName: channelDetails.channelName,
      username: channelDetails.channelName.toLowerCase().replace(/\s+/g, ''),
      platform: 'youtube',
      displayName: channelDetails.channelName,
      profileImage: channelDetails.profileImage,
      description: channelDetails.description,
      subscriberCount: channelDetails.subscriberCount,
      videoCount: channelDetails.videoCount,
      uploadsPlaylistId: channelDetails.uploadsPlaylistId,
    });

    await account.save();
    console.log(`Channel ${channelDetails.channelName} (${channelId}) added to monitoring`);

    res.status(201).json({
      _id: account._id,
      channelId: account.channelId,
      channelName: account.channelName,
      displayName: account.displayName,
      profileImage: account.profileImage,
      description: account.description,
      subscriberCount: account.subscriberCount,
      videoCount: account.videoCount,
      uploadsPlaylistId: account.uploadsPlaylistId,
      monitoringStatus: account.monitoringStatus,
      alertCount: 0,
    });
  } catch (err) {
    console.error('Error adding channel:', err);
    res.status(500).json({ msg: 'Server error while adding channel' });
  }
};

/**
 * Get all monitored channels
 * GET /channels
 */
exports.getChannels = async (req, res) => {
  try {
    const accounts = await MonitoredAccount.find({ platform: 'youtube' });

    // Enrich accounts with alert counts
    const enrichedAccounts = await Promise.all(
      accounts.map(async (account) => {
        const alertCount = await Alert.countDocuments({
          accountId: account._id,
          platform: 'youtube',
        });

        const accountObj = account.toObject ? account.toObject() : account;
        return {
          ...accountObj,
          alertCount: alertCount,
        };
      })
    );

    res.json(enrichedAccounts);
  } catch (err) {
    console.error('Error fetching channels:', err);
    res.status(500).json({ msg: 'Server error while fetching channels' });
  }
};

/**
 * Get a specific channel by ID
 * GET /channels/:id
 */
exports.getChannelById = async (req, res) => {
  try {
    const account = await MonitoredAccount.findById(req.params.id);

    if (!account) {
      return res.status(404).json({ msg: 'Channel not found' });
    }

    const alertCount = await Alert.countDocuments({
      accountId: account._id,
      platform: 'youtube',
    });

    const accountObj = account.toObject ? account.toObject() : account;
    res.json({
      ...accountObj,
      alertCount: alertCount,
    });
  } catch (err) {
    console.error('Error fetching channel:', err);
    res.status(500).json({ msg: 'Server error while fetching channel' });
  }
};

/**
 * Remove a monitored channel
 * DELETE /channels/:id
 */
exports.removeChannel = async (req, res) => {
  try {
    const account = await MonitoredAccount.findByIdAndDelete(req.params.id);

    if (!account) {
      return res.status(404).json({ msg: 'Channel not found' });
    }

    await Alert.deleteMany({
      $or: [
        { accountId: account._id },
        { platform: 'youtube', channelId: account.channelId },
        { platform: 'youtube', channelName: account.channelName },
        { platform: 'youtube', source: account.channelName },
        { platform: 'youtube', source: account.username },
      ],
    });

    console.log(`Channel ${account.channelName} removed from monitoring`);
    res.json({ success: true, message: 'Channel removed from monitoring', channelId: account.channelId });
  } catch (err) {
    console.error('Error removing channel:', err);
    res.status(500).json({ success: false, message: 'Server error while removing channel' });
  }
};

/**
 * Update channel monitoring status
 * PATCH /channels/:id/status
 */
exports.updateChannelStatus = async (req, res) => {
  const { monitoringStatus } = req.body;

  if (!['active', 'paused', 'error'].includes(monitoringStatus)) {
    return res.status(400).json({ msg: 'Invalid monitoring status' });
  }

  try {
    const account = await MonitoredAccount.findByIdAndUpdate(
      req.params.id,
      { monitoringStatus },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ msg: 'Channel not found' });
    }

    res.json({ success: true, message: 'Channel status updated', monitoringStatus: account.monitoringStatus });
  } catch (err) {
    console.error('Error updating channel status:', err);
    res.status(500).json({ success: false, message: 'Server error while updating channel status' });
  }
};

/**
 * Refresh channel profile/metadata
 * PUT /channels/:id/refresh
 */
exports.refreshChannel = async (req, res) => {
  try {
    const account = await MonitoredAccount.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    let channelDetails;
    try {
      channelDetails = await getChannelUploadsPlaylist(account.channelId);
    } catch (error) {
      console.error('Error fetching channel details from YouTube:', error);
      return res.status(400).json({ success: false, message: 'Failed to fetch channel details from YouTube' });
    }

    account.channelName = channelDetails.channelName;
    account.username = (channelDetails.channelName || '').toLowerCase().replace(/\s+/g, '');
    account.displayName = channelDetails.channelName;
    account.profileImage = channelDetails.profileImage;
    account.description = channelDetails.description;
    account.subscriberCount = channelDetails.subscriberCount;
    account.videoCount = channelDetails.videoCount;
    account.uploadsPlaylistId = channelDetails.uploadsPlaylistId;

    await account.save();

    res.json({ success: true, message: 'Channel refreshed', account });
  } catch (err) {
    console.error('Error refreshing channel:', err);
    res.status(500).json({ success: false, message: 'Server error while refreshing channel' });
  }
};
