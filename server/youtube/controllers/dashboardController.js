const Alert = require("../models/Alert");
const MonitoredAccount = require("../models/MonitoredAccount");

/**
 * @desc Get aggregated dashboard stats for YouTube
 * @route GET /dashboard/stats?days=7
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    console.log(`[YouTube Dashboard] Fetching stats for ${days} days, since: ${since.toISOString()}`);

    // Fetch all data in parallel
    const [
      totalVideosAllTime,
      totalVideosWithinPeriod,
      unreadVideos,
      totalChannels,
      activeChannels,
      engagementStats,
      recentVideos,
      mediaFeedVideos,
    ] = await Promise.all([
      // Total videos (all-time)
      Alert.countDocuments({ platform: "youtube" }),
      // Videos within the period
      Alert.countDocuments({ 
        platform: "youtube",
        publishedAt: { $gte: since } 
      }),
      // Unread videos
      Alert.countDocuments({
        platform: "youtube",
        isViewed: false,
      }),
      // Total channels
      MonitoredAccount.countDocuments(),
      // Active channels
      MonitoredAccount.countDocuments({ monitoringStatus: "active" }),
      // Aggregated engagement stats
      Alert.aggregate([
        {
          $match: {
            platform: "youtube",
            publishedAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: null,
            totalViews: { $sum: { $ifNull: ["$viewCount", 0] } },
            totalLikes: { $sum: { $ifNull: ["$likeCount", 0] } },
            totalComments: { $sum: { $ifNull: ["$commentCount", 0] } },
          },
        },
      ]),
      // Recent videos
      Alert.find({
        platform: "youtube",
        publishedAt: { $gte: since },
      })
        .sort({ publishedAt: -1 })
        .limit(5)
        .select(
          "videoTitle videoDescription channelName channelProfileImage thumbnail url publishedAt videoId viewCount likeCount commentCount"
        ),
      // Media feed (all recent videos)
      Alert.find({
        platform: "youtube",
        publishedAt: { $gte: since },
      })
        .sort({ publishedAt: -1 })
        .limit(20)
        .select(
          "videoTitle videoDescription channelName channelProfileImage thumbnail url publishedAt videoId viewCount likeCount commentCount"
        )
        .lean(),
    ]);

    console.log(`[YouTube Dashboard] Total videos (all-time): ${totalVideosAllTime}`);
    console.log(`[YouTube Dashboard] Videos (${days} days): ${totalVideosWithinPeriod}`);
    console.log(`[YouTube Dashboard] Unread videos: ${unreadVideos}`);

    // Calculate engagement
    const engData = engagementStats[0] || {};
    const totalEngagement =
      (engData.totalViews || 0) +
      (engData.totalLikes || 0) +
      (engData.totalComments || 0) ||
      totalVideosWithinPeriod * 0.5;

    // Calculate sentiment (simulated based on engagement)
    // Higher engagement = more positive
    const sentimentScore = Math.min((engData.totalLikes || 0) / Math.max((engData.totalComments || 1), 1), 1);
    const sentiment = {
      positive: Math.round(sentimentScore * 100),
      negative: Math.round((1 - sentimentScore) * 0.3 * 100),
      neutral: Math.round((1 - sentimentScore) * 0.7 * 100),
    };

    // Calculate trend
    const twoPeriodsAgo = new Date(Date.now() - 2 * parseInt(days) * 24 * 60 * 60 * 1000);
    const onePeriodsAgo = since;
    const videosBeforePeriod = await Alert.countDocuments({
      platform: "youtube",
      publishedAt: {
        $gte: twoPeriodsAgo,
        $lt: onePeriodsAgo,
      },
    });

    const trend = totalVideosWithinPeriod >= videosBeforePeriod 
      ? `+${totalVideosWithinPeriod - videosBeforePeriod}` 
      : `-${videosBeforePeriod - totalVideosWithinPeriod}`;

    // Format recent mentions
    const youtubeRecentMentions = recentVideos.map((v) => ({
      _id: v._id,
      platform: "youtube",
      authorUsername: v.channelName,
      authorDisplayName: v.channelName,
      authorAvatar: v.channelProfileImage,
      content: v.videoTitle,
      description: v.videoDescription,
      postUrl: v.url,
      postType: "video",
      thumbnail: v.thumbnail,
      metrics: {
        views: v.viewCount,
        likes: v.likeCount,
        comments: v.commentCount,
      },
      createdAt: v.publishedAt,
    }));

    // Format media feed
    const youtubeMediaFeed = mediaFeedVideos.map((v) => ({
      _id: v._id.toString(),
      title: v.videoTitle,
      channel: v.channelName,
      views: v.viewCount || 0,
      likes: v.likeCount || 0,
      comments: v.commentCount || 0,
      thumbnailUrl: v.thumbnail,
      postUrl: v.url,
      platform: "youtube",
      activityType: "video",
      metrics: {
        views: v.viewCount,
        likes: v.likeCount,
        comments: v.commentCount,
      },
      profileImage: v.channelProfileImage || "",
      publishedAt: v.publishedAt,
    }));

    return res.status(200).json({
      success: true,
      platform: "youtube",
      stats: {
        mentions: totalVideosAllTime,
        periodMentions: totalVideosWithinPeriod,
        mentionsTrend: trend,
        engagement: Math.round(totalEngagement),
        totalAccounts: totalChannels,
        activeAccounts: activeChannels,
        unreadAlerts: unreadVideos,
        sentiment,
        recentMentions: youtubeRecentMentions,
        mediaFeed: youtubeMediaFeed,
        sources: [
          {
            name: "YouTube",
            value: totalVideosAllTime,
            color: "#FF0000",
          },
        ],
      },
    });
  } catch (error) {
    console.error("[YouTube Dashboard Error]", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error: error.message,
    });
  }
};

/**
 * @desc Get recent videos/mentions for YouTube
 * @route GET /dashboard/mentions?limit=10
 */
exports.getRecentMentions = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const videos = await Alert.find({ platform: "youtube" })
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .select(
        "videoTitle videoDescription channelName channelProfileImage thumbnail url publishedAt videoId viewCount likeCount commentCount"
      );

    const mentions = videos.map((v) => ({
      _id: v._id,
      platform: "youtube",
      authorUsername: v.channelName,
      authorDisplayName: v.channelName,
      authorAvatar: v.channelProfileImage,
      content: v.videoTitle,
      description: v.videoDescription,
      postUrl: v.url,
      postType: "video",
      thumbnail: v.thumbnail,
      metrics: {
        views: v.viewCount,
        likes: v.likeCount,
        comments: v.commentCount,
      },
      createdAt: v.publishedAt,
    }));

    return res.status(200).json({
      success: true,
      mentions,
    });
  } catch (error) {
    console.error("[YouTube Mentions Error]", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recent mentions",
      error: error.message,
    });
  }
};

/**
 * @desc Get timeline chart data for YouTube
 * @route GET /dashboard/timeline?days=7
 */
exports.getTimeline = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const timeline = await Alert.aggregate([
      {
        $match: {
          platform: "youtube",
          publishedAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$publishedAt" },
          },
          count: { $sum: 1 },
          engagement: { $sum: { $add: ["$viewCount", "$likeCount", "$commentCount"] } },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    return res.status(200).json({
      success: true,
      timeline,
    });
  } catch (error) {
    console.error("[YouTube Timeline Error]", error);
    res.status(500).json({
      success: false,
      message: "Error fetching timeline",
      error: error.message,
    });
  }
};

/**
 * @desc Get YouTube channel accounts
 * @route GET /dashboard/accounts
 */
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await MonitoredAccount.find({
      monitoringStatus: "active",
    })
      .limit(10)
      .select(
        "channelId channelName profileImage followers monitoringStatus alertCount bio lastChecked"
      );

    const mapped = accounts.map((a) => ({
      _id: a._id,
      username: a.channelName || a.username,
      displayName: a.channelName || a.displayName,
      profileImage: a.profileImage,
      followers: a.followers,
      bio: a.bio,
      alertCount: a.alertCount,
      monitoringStatus: a.monitoringStatus,
      monitoringActive: a.monitoringStatus === "active",
      lastChecked: a.lastChecked,
    }));

    return res.status(200).json({
      success: true,
      accounts: mapped,
    });
  } catch (error) {
    console.error("[YouTube Accounts Error]", error);
    res.status(500).json({
      success: false,
      message: "Error fetching accounts",
      error: error.message,
    });
  }
};

/**
 * @desc Get total video count (validation endpoint)
 * @route GET /dashboard/video-count
 */
exports.getTotalVideoCount = async (req, res) => {
  try {
    const totalCount = await Alert.countDocuments({ platform: "youtube" });
    
    return res.status(200).json({
      success: true,
      total: totalCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[YouTube Video Count Error]", error);
    res.status(500).json({
      success: false,
      message: "Error fetching video count",
      error: error.message,
    });
  }
};
