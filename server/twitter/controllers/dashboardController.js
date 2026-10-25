const Alert = require("../models/Alert");
const MonitoredAccount = require("../models/MonitoredAccount");
const PlatformData = require("../models/PlatformData");
const Keyword = require("../models/Keyword");
const logger = require("../config/logger");

// Demo data generators for non-Twitter platforms
const generateDemoStats = (platform, days = 7) => {
  const seeds = {
    facebook: {
      mentions: 1240,
      engagement: 890,
      positive: 31,
      negative: 19,
      neutral: 50,
    },
    youtube: {
      mentions: 560,
      engagement: 4200,
      positive: 45,
      negative: 12,
      neutral: 43,
    },
    instagram: {
      mentions: 980,
      engagement: 2100,
      positive: 38,
      negative: 22,
      neutral: 40,
    },
    tiktok: {
      mentions: 2340,
      engagement: 8900,
      positive: 52,
      negative: 18,
      neutral: 30,
    },
    telegram: {
      mentions: 430,
      engagement: 320,
      positive: 28,
      negative: 35,
      neutral: 37,
    },
    snapchat: {
      mentions: 210,
      engagement: 180,
      positive: 40,
      negative: 15,
      neutral: 45,
    },
    bluesky: {
      mentions: 150,
      engagement: 95,
      positive: 55,
      negative: 10,
      neutral: 35,
    },
    zangi: {
      mentions: 80,
      engagement: 60,
      positive: 30,
      negative: 20,
      neutral: 50,
    },
  };
  const s = seeds[platform] || seeds.facebook;
  return {
    mentions: s.mentions,
    engagement: s.engagement,
    sentiment: {
      positive: s.positive,
      negative: s.negative,
      neutral: s.neutral,
    },
    trend: `+${Math.floor(Math.random() * 500 + 100)}`,
  };
};

const generateDemoMentions = (platform, count = 5) => {
  const users = {
    facebook: ["ali_fb", "sarah_m", "john_doe", "maria_k", "umar_ali"],
    youtube: [
      "techguru_yt",
      "news_channel",
      "reporter_pk",
      "daily_brief",
      "viral_vid",
    ],
    instagram: [
      "insta_user1",
      "photo_queen",
      "travel_pk",
      "foodie_pk",
      "style_pk",
    ],
    tiktok: ["tiktoker_1", "viral_tik", "funny_pk", "dance_pk", "news_tik"],
    telegram: ["tg_channel1", "tg_group_1", "news_tg", "alerts_tg", "info_tg"],
    snapchat: ["snap_user1", "snap_pk", "snap_news", "snap_viral"],
    bluesky: ["bsky_user1", "bsky_pk", "bsky_news"],
    zangi: ["zangi_1", "zangi_2", "zangi_3"],
  };
  const contents = [
    "Talking about recent events in the region",
    "Sharing information about ongoing situation",
    "Video posted about local developments",
    "Spreading awareness about safety measures",
    "Update on current operations",
  ];
  const names = users[platform] || users.facebook;
  return Array.from({ length: count }, (_, i) => ({
    _id: `demo_${platform}_${i}`,
    platform,
    authorUsername: names[i % names.length],
    authorDisplayName: names[i % names.length].replace(/_/g, " "),
    content: contents[i % contents.length],
    postUrl: "#",
    postType: platform === "youtube" ? "video" : "post",
    likes: Math.floor(Math.random() * 500),
    shares: Math.floor(Math.random() * 100),
    comments: Math.floor(Math.random() * 200),
    createdAt: new Date(Date.now() - i * 3600000).toISOString(),
  }));
};

const generateDemoVideos = (platform) => {
  const titles = [
    "Identity Collapse: The Psychology of Recruitment",
    "Operation Response: Cross-Border Analysis",
    "Expert Analysis: Regional Security Update",
    "Breaking: Latest developments in monitoring",
    "Deep Dive: Social Media Intelligence",
  ];
  return titles.slice(0, 3).map((title, i) => ({
    _id: `video_${platform}_${i}`,
    platform,
    title,
    thumbnailUrl: "",
    postUrl: "#",
    views: Math.floor(Math.random() * 100000),
    likes: Math.floor(Math.random() * 5000),
    createdAt: new Date(Date.now() - i * 7200000).toISOString(),
  }));
};

// @desc  Get total alert count without filters (validation endpoint)
// @route GET /api/dashboard/alert-count
const getTotalAlertCount = async (req, res, next) => {
  try {
    const totalCount = await Alert.countDocuments({});
    logger.info(`[Alert Count Validation] Total alerts in database: ${totalCount}`);
    
    return res.status(200).json({
      success: true,
      total: totalCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`[Alert Count Error] ${error.message}`, error);
    next(error);
  }
};

// @desc  Get aggregated dashboard stats for a platform
// @route GET /api/dashboard/stats?platform=twitter&days=7
const getDashboardStats = async (req, res, next) => {
  try {
    const { platform = "all", days = 7 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    logger.info(`[Dashboard] Platform: ${platform}, Days: ${days}, Since: ${since.toISOString()}`);

    if (platform === "twitter" || platform === "all") {
      // Real Twitter data from Alert collection
      // CRITICAL: Count TOTAL alerts (all-time) separately from period-filtered data
      const [
        totalAlertsAllTime,
        totalAlertsWithinPeriod,
        unreadAlerts,
        totalAccounts,
        activeAccounts,
        sentimentBuckets,
        recentAlerts,
        mediaFeedAlerts,
      ] = await Promise.all([
        Alert.countDocuments({}),
        Alert.countDocuments({ createdAt: { $gte: since } }),
        Alert.countDocuments({
          $or: [
            { isViewed: false },
            { isViewed: { $exists: false }, isRead: false },
            { isViewed: { $exists: false }, isRead: { $exists: false } },
          ],
        }),
        MonitoredAccount.countDocuments(),
        MonitoredAccount.countDocuments({ monitoringStatus: "active" }),
        Alert.aggregate([
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: "$sentiment",
              count: { $sum: 1 },
            },
          },
        ]),
        Alert.find({ createdAt: { $gte: since } })
          .sort({ createdAt: -1 })
          .limit(5)
          .select(
            "username displayName content activityType createdAt tweetUrl profileImage",
          ),
        Alert.find({ createdAt: { $gte: since } })
          .sort({ createdAt: -1 })
          .limit(20)
          .select(
            "username displayName content media tweetUrl activityType tweetCreatedAt metrics profileImage createdAt",
          )
          .lean(),
      ]);

      logger.info(`[Dashboard Stats] Total All-Time Alerts (no filter): ${totalAlertsAllTime}`);
      logger.info(`[Dashboard Stats] Period Alerts (${days} days): ${totalAlertsWithinPeriod}`);
      logger.info(`[Dashboard Stats] Unread Alerts: ${unreadAlerts}`);

      const totalForSentiment =
        sentimentBuckets.reduce((a, b) => a + b.count, 0) || 1;
      const sentimentMap = {};
      sentimentBuckets.forEach((b) => (sentimentMap[b._id] = b.count));

      const mentionsTrend = await Alert.countDocuments({
        createdAt: {
          $gte: new Date(Date.now() - 2 * parseInt(days) * 24 * 60 * 60 * 1000),
          $lt: since,
        },
      });

      // Sources distribution for all platform mode
      // Use totalAlertsAllTime to match the stats card total
      const sourcesData =
        platform === "all"
          ? [
              { name: "Twitter", value: totalAlertsAllTime, color: "#1DA1F2" },
              { name: "Facebook", value: 1240, color: "#1877F2" },
              { name: "YouTube", value: 560, color: "#FF0000" },
              { name: "Instagram", value: 980, color: "#E1306C" },
              { name: "TikTok", value: 2340, color: "#010101" },
              { name: "Telegram", value: 430, color: "#2CA5E0" },
              { name: "Snapchat", value: 210, color: "#FFFC00" },
              { name: "BlueSky", value: 150, color: "#0085FF" },
              { name: "Zangi", value: 80, color: "#7B68EE" },
            ]
          : [{ name: "Twitter", value: totalAlertsAllTime, color: "#1DA1F2" }];

      logger.info(`[Dashboard Stats] Sources - Twitter total: ${totalAlertsAllTime}, Period: ${totalAlertsWithinPeriod}`);

      const twitterMentions = recentAlerts.map((a) => ({
        _id: a._id,
        platform: "twitter",
        authorUsername: a.username,
        authorDisplayName: a.displayName,
        authorAvatar: a.profileImage,
        content: a.content,
        postUrl: a.tweetUrl,
        postType: a.activityType,
        media: a.media || [],
        createdAt: a.createdAt,
      }));

      const twitterEngagement = await Alert.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            totalLikes: { $sum: { $ifNull: ["$metrics.likes", 0] } },
            totalRetweets: { $sum: { $ifNull: ["$metrics.retweets", 0] } },
            totalReplies: { $sum: { $ifNull: ["$metrics.replies", 0] } },
          },
        },
      ]);
      const eng = twitterEngagement[0] || {};
      const totalEngagement =
        (eng.totalLikes || 0) +
          (eng.totalRetweets || 0) +
          (eng.totalReplies || 0) || totalAlertsWithinPeriod * 0.82;

      return res.status(200).json({
        success: true,
        platform: platform === "all" ? "all" : "twitter",
        stats: {
          mentions: totalAlertsAllTime,
          periodMentions: totalAlertsWithinPeriod,
          mentionsTrend: `+${mentionsTrend}`,
          engagement: Math.round(totalEngagement),
          totalAccounts,
          activeAccounts,
          unreadAlerts,
          sentiment: {
            positive: Math.round(
              ((sentimentMap.positive ||
                Math.floor(totalForSentiment * 0.246)) /
                totalForSentiment) *
                100,
            ),
            negative: Math.round(
              ((sentimentMap.negative ||
                Math.floor(totalForSentiment * 0.246)) /
                totalForSentiment) *
                100,
            ),
            neutral: Math.round(
              ((sentimentMap.neutral || Math.floor(totalForSentiment * 0.11)) /
                totalForSentiment) *
                100,
            ),
          },
          recentMentions: twitterMentions,
          sources: sourcesData,
          mediaFeed: mediaFeedAlerts.map((a) => ({
            _id: a._id.toString(),
            title: a.content,
            channel: a.displayName || `@${a.username}`,
            views: (
              a.tweetCreatedAt ||
              a.createdAt ||
              new Date()
            ).toISOString(),
            thumbnailUrl:
              (a.media || []).find((m) => m.previewUrl)?.previewUrl ||
              (a.media || []).find((m) => m.url)?.url ||
              "",
            postUrl: a.tweetUrl,
            platform: "twitter",
            activityType: a.activityType,
            metrics: a.metrics || {},
            profileImage: a.profileImage || "",
          })),
        },
      });
    }

    // Non-Twitter platforms → demo data
    const demo = generateDemoStats(platform, parseInt(days));
    const mentions = generateDemoMentions(platform);
    const videos = platform === "youtube" ? generateDemoVideos(platform) : [];

    return res.status(200).json({
      success: true,
      platform,
      stats: {
        mentions: demo.mentions,
        mentionsTrend: demo.trend,
        engagement: demo.engagement,
        totalAccounts: 0,
        activeAccounts: 0,
        unreadAlerts: 0,
        sentiment: demo.sentiment,
        recentMentions: mentions,
        mediaFeed: videos,
        sources: [
          {
            name: platform.charAt(0).toUpperCase() + platform.slice(1),
            value: demo.mentions,
            color: "#3b82f6",
          },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Get recent mentions for a platform
// @route GET /api/dashboard/mentions?platform=twitter&limit=10
const getRecentMentions = async (req, res, next) => {
  try {
    const { platform = "twitter", limit = 10 } = req.query;

    if (platform === "twitter") {
      const alerts = await Alert.find()
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .select(
          "username displayName content activityType createdAt tweetUrl profileImage media",
        );

      const mentions = alerts.map((a) => ({
        _id: a._id,
        platform: "twitter",
        authorUsername: a.username,
        authorDisplayName: a.displayName,
        authorAvatar: a.profileImage,
        content: a.content,
        postUrl: a.tweetUrl,
        postType: a.activityType,
        media: a.media || [],
        createdAt: a.createdAt,
      }));

      return res.status(200).json({ success: true, mentions });
    }

    return res.status(200).json({
      success: true,
      mentions: generateDemoMentions(platform, parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
};

// @desc  Get timeline chart data
// @route GET /api/dashboard/timeline?platform=twitter&days=7
const getTimeline = async (req, res, next) => {
  try {
    const { platform = "twitter", days = 7 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    if (platform === "twitter") {
      const timeline = await Alert.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return res.status(200).json({ success: true, timeline });
    }

    // Demo timeline
    const timeline = Array.from({ length: parseInt(days) }, (_, i) => {
      const d = new Date(since.getTime() + i * 86400000);
      return {
        _id: d.toISOString().split("T")[0],
        count: Math.floor(Math.random() * 200 + 50),
      };
    });

    return res.status(200).json({ success: true, timeline });
  } catch (error) {
    next(error);
  }
};

// @desc  Get platform accounts
// @route GET /api/dashboard/accounts?platform=twitter|all
const getPlatformAccounts = async (req, res, next) => {
  try {
    const { platform = "twitter" } = req.query;

    if (platform === "twitter" || platform === "all") {
      const accounts = await MonitoredAccount.find({})
        .select(
          "username displayName profileImage followers monitoringStatus alertCount bio tweetsCount following verified lastChecked",
        );

      const mapped = accounts.map((a) => ({
        _id: a._id,
        username: a.username,
        displayName: a.displayName,
        profileImage: a.profileImage,
        followers: a.followers,
        following: a.following,
        tweetsCount: a.tweetsCount,
        bio: a.bio,
        verified: a.verified,
        lastChecked: a.lastChecked,
        alertCount: a.alertCount,
        monitoringStatus: a.monitoringStatus,
        monitoringActive: a.monitoringStatus === "active",
      }));

      return res.status(200).json({ success: true, accounts: mapped });
    }

    // Demo accounts
    const demoAccounts = [
      {
        _id: "1",
        username: "account_1",
        displayName: "Ettihad e Mujahideen",
        followers: 31000,
        activity: "Most Active",
      },
      {
        _id: "2",
        username: "account_2",
        displayName: "Sippa Salar",
        followers: 12000,
        activity: "Not Active",
      },
      {
        _id: "3",
        username: "account_3",
        displayName: "blackmask",
        followers: 3000,
        activity: "Medium",
      },
    ];

    return res.status(200).json({ success: true, accounts: demoAccounts });
  } catch (error) {
    next(error);
  }
};

// @desc  Get all keywords
// @route GET /api/dashboard/keywords
const getKeywords = async (req, res, next) => {
  try {
    let keywords = await Keyword.find({ active: true }).sort({ createdAt: -1 });

    if (keywords.length === 0) {
      // Seed default keywords
      const defaults = [
        "Inqilab",
        "freedom",
        "jihaad",
        "musakhel",
        "Raafzi",
        "BLA",
        "Punjabi",
        "Noushki",
      ];
      keywords = await Keyword.insertMany(
        defaults.map((w) => ({ word: w.toLowerCase() })),
      );
    }

    return res.status(200).json({ success: true, keywords });
  } catch (error) {
    next(error);
  }
};

// @desc  Add a keyword
// @route POST /api/dashboard/keywords
const addKeyword = async (req, res, next) => {
  try {
    const { word } = req.body;
    if (!word || word.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Keyword is required" });
    }
    const keyword = await Keyword.findOneAndUpdate(
      { word: word.trim().toLowerCase() },
      { active: true },
      { upsert: true, new: true },
    );
    return res.status(201).json({ success: true, keyword });
  } catch (error) {
    next(error);
  }
};

// @desc  Remove a keyword
// @route DELETE /api/dashboard/keywords/:id
const removeKeyword = async (req, res, next) => {
  try {
    await Keyword.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Keyword removed" });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unified monitoring cycle status
// @route   GET /api/dashboard/monitoring-status
const getMonitoringStatus = async (req, res, next) => {
  try {
    const { getUnifiedCycleStatus } = require('../jobs/monitoringJob');
    const cycleStatus = getUnifiedCycleStatus();
    
    const totalAccounts = await MonitoredAccount.countDocuments();
    const activeAccounts = await MonitoredAccount.countDocuments({ monitoringStatus: 'active' });
    const totalAlerts = await Alert.countDocuments({ platform: 'twitter' });

    res.status(200).json({
      success: true,
      data: {
        unifiedCycle: {
          ...cycleStatus,
          description: 'ONE centralized monitoring cycle for all Twitter accounts',
          isUnified: true,
        },
        accounts: {
          total: totalAccounts,
          active: activeAccounts,
          paused: totalAccounts - activeAccounts,
        },
        alerts: {
          total: totalAlerts,
        },
        info: {
          newAccountsAutoIncluded: 'Yes - automatically included in next cycle',
          separateJobsPerAccount: 'No - single unified cycle processes all',
          message: 'Twitter backend uses ONE shared scraping cycle for all monitored accounts',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getTotalAlertCount,
  getRecentMentions,
  getTimeline,
  getPlatformAccounts,
  getKeywords,
  addKeyword,
  removeKeyword,
  getMonitoringStatus,
};
