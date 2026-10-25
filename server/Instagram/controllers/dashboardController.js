const Alert = require("../models/Alert");
const MonitoredAccount = require("../models/MonitoredAccount");
const {
  isVideoFileUrl,
  extractMediaUrl,
} = require("../services/instagramService");

const toIsoDay = (date) => new Date(date).toISOString().split("T")[0];
const instagramProxyBase = `${process.env.INSTAGRAM_PUBLIC_URL || "http://localhost:5003"}/instagram/posts/proxy/image`;

const toProxyImageUrl = (url) => {
  if (!url || typeof url !== "string") return "";
  if (isVideoFileUrl(url)) return "";
  const isAbsolute = url.startsWith("http://") || url.startsWith("https://");
  if (!isAbsolute) return url;
  return `${instagramProxyBase}?url=${encodeURIComponent(url)}`;
};

const resolveImageThumbnail = (rawUrl) => {
  if (!rawUrl || isVideoFileUrl(rawUrl)) return null;
  const proxied = toProxyImageUrl(rawUrl);
  return proxied || null;
};

const getAlertMedia = (alert) => {
  const media = [];
  const postType = String(alert.postType || alert.type || "").toUpperCase();
  const isCarousel =
    postType === "CAROUSEL" || String(alert.type) === "Carousel";
  const isVideo = postType === "VIDEO" || String(alert.type) === "Video";

  const addImageMedia = (rawUrl, type = "image") => {
    const thumb = resolveImageThumbnail(rawUrl);
    if (!thumb) return;
    if (media.some((m) => m.previewUrl === thumb)) return;
    media.push({
      url: thumb,
      previewUrl: thumb,
      type,
    });
  };

  if (Array.isArray(alert.images)) {
    alert.images.forEach((item) => {
      const rawUrl = extractMediaUrl(item);
      addImageMedia(rawUrl, "image");
    });
  }

  if (isVideo) {
    const videoSrc =
      alert.videoUrl ||
      (isVideoFileUrl(alert.displayUrl) ? alert.displayUrl : null);
    const thumb =
      resolveImageThumbnail(alert.displayUrl) ||
      (media.length > 0 ? media[0].previewUrl : null);

    if (thumb) {
      const exists = media.some((m) => m.previewUrl === thumb);
      if (!exists) {
        media.unshift({
          url: thumb,
          previewUrl: thumb,
          type: "video",
          videoSrc: videoSrc || undefined,
        });
      } else {
        const entry = media.find((m) => m.previewUrl === thumb);
        if (entry) entry.type = "video";
      }
    } else if (videoSrc) {
      media.unshift({
        url: videoSrc,
        previewUrl: "",
        type: "video",
        useVideoPreview: true,
      });
    }
  } else if (!isCarousel && alert.displayUrl) {
    addImageMedia(
      alert.displayUrl,
      isVideo ? "video" : "image",
    );
  } else if (isCarousel && alert.displayUrl && media.length === 0) {
    addImageMedia(alert.displayUrl, "image");
  }

  return media;
};

const toMention = (alert) => {
  const media = getAlertMedia(alert);
  const avatarSource =
    alert.profileImage ||
    (alert.displayUrl && !isVideoFileUrl(alert.displayUrl)
      ? alert.displayUrl
      : "");
  const fallbackAvatar = toProxyImageUrl(avatarSource);

  return {
    _id: alert._id,
    platform: "instagram",
    authorUsername: alert.authorUsername || alert.source || "Unknown",
    authorDisplayName:
      alert.authorDisplayName || alert.authorUsername || alert.source,
    authorAvatar: fallbackAvatar,
    content: alert.caption || alert.content || "",
    postUrl: alert.url,
    postType: alert.postType || alert.type || "IMAGE",
    media,
    createdAt: alert.createdAt || alert.timestamp,
    metrics: {
      likes: alert.likesCount || 0,
      shares: 0,
      comments: alert.commentsCount || 0,
    },
  };
};

// @desc  Get aggregated Instagram dashboard stats
// @route GET /instagram/dashboard/stats?days=7
exports.getDashboardStats = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const parsedDays = Math.max(1, parseInt(days, 10) || 7);
    const since = new Date(Date.now() - parsedDays * 24 * 60 * 60 * 1000);

    const [
      totalAlertsAllTime,
      totalAlertsWithinPeriod,
      unreadAlerts,
      totalAccounts,
      activeAccounts,
      recentAlerts,
      engagementStats,
    ] = await Promise.all([
      Alert.countDocuments({ platform: "instagram" }),
      Alert.countDocuments({
        platform: "instagram",
        createdAt: { $gte: since },
      }),
      Alert.countDocuments({
        platform: "instagram",
        isRead: false,
      }),
      MonitoredAccount.countDocuments({ platform: "instagram" }),
      MonitoredAccount.countDocuments({
        platform: "instagram",
        monitoringStatus: "active",
      }),
      Alert.find({
        platform: "instagram",
        createdAt: { $gte: since },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Alert.aggregate([
        {
          $match: {
            platform: "instagram",
            createdAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: null,
            totalLikes: { $sum: { $ifNull: ["$likesCount", 0] } },
            totalComments: { $sum: { $ifNull: ["$commentsCount", 0] } },
          },
        },
      ]),
    ]);

    const previousPeriodSince = new Date(
      Date.now() - parsedDays * 2 * 24 * 60 * 60 * 1000,
    );
    const previousPeriodCount = await Alert.countDocuments({
      platform: "instagram",
      createdAt: {
        $gte: previousPeriodSince,
        $lt: since,
      },
    });

    const delta = totalAlertsWithinPeriod - previousPeriodCount;
    const mentionsTrend = `${delta >= 0 ? "+" : ""}${delta}`;

    const sourceMap = recentAlerts.reduce((acc, alert) => {
      const key = alert.source || alert.authorUsername || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const sources = Object.entries(sourceMap).map(([name, value]) => ({
      name,
      value,
      color: "#E1306C",
    }));

    const eng = engagementStats[0] || {};
    const totalLikes = eng.totalLikes || 0;
    const totalComments = eng.totalComments || 0;
    const totalEngagement = totalLikes + totalComments;

    return res.status(200).json({
      success: true,
      platform: "instagram",
      stats: {
        mentions: totalAlertsAllTime,
        periodMentions: totalAlertsWithinPeriod,
        mentionsTrend,
        engagement: totalEngagement,
        totalAccounts,
        activeAccounts,
        unreadAlerts,
        likes: totalLikes,
        comments: totalComments,
        sentiment: {
          positive: 42,
          negative: 20,
          neutral: 38,
        },
        recentMentions: recentAlerts.map(toMention),
        sources: sources.length
          ? sources
          : [{ name: "Instagram", value: Math.max(1, totalAlertsAllTime), color: "#E1306C" }],
      },
    });
  } catch (error) {
    console.error("[Instagram Dashboard Stats Error]", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching Instagram dashboard stats",
      error: error.message,
    });
  }
};

// @desc  Get recent Instagram mentions/posts
// @route GET /instagram/dashboard/mentions?limit=10
exports.getRecentMentions = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const parsedLimit = Math.max(1, Math.min(parseInt(limit, 10) || 10, 50));

    const alerts = await Alert.find({ platform: "instagram" })
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean();

    return res.status(200).json({
      success: true,
      mentions: alerts.map(toMention),
    });
  } catch (error) {
    console.error("[Instagram Dashboard Mentions Error]", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching Instagram mentions",
      error: error.message,
    });
  }
};

// @desc  Get Instagram timeline data
// @route GET /instagram/dashboard/timeline?days=7
exports.getTimeline = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const parsedDays = Math.max(1, parseInt(days, 10) || 7);
    const since = new Date(Date.now() - parsedDays * 24 * 60 * 60 * 1000);

    const alerts = await Alert.find({
      platform: "instagram",
      createdAt: { $gte: since },
    })
      .select("createdAt timestamp")
      .lean();

    const timelineMap = {};
    for (let i = 0; i < parsedDays; i += 1) {
      const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      timelineMap[toIsoDay(d)] = 0;
    }

    alerts.forEach((alert) => {
      const day = toIsoDay(alert.createdAt || alert.timestamp || new Date());
      if (timelineMap[day] !== undefined) {
        timelineMap[day] += 1;
      }
    });

    return res.status(200).json({
      success: true,
      timeline: Object.entries(timelineMap).map(([day, count]) => ({
        _id: day,
        count,
      })),
    });
  } catch (error) {
    console.error("[Instagram Dashboard Timeline Error]", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching Instagram timeline",
      error: error.message,
    });
  }
};

// @desc  Get Instagram monitored accounts for dashboard
// @route GET /instagram/dashboard/accounts
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await MonitoredAccount.find({ platform: "instagram" })
      .sort({ alertCount: -1, lastChecked: -1 })
      .limit(20)
      .lean();

    return res.status(200).json({
      success: true,
      accounts: accounts.map((account) => ({
        _id: account._id,
        username: account.username,
        displayName: account.displayName || account.username,
        profileImage: account.profileImage || "",
        followers: account.followers || 0,
        alertCount: account.alertCount || 0,
        monitoringStatus: account.monitoringStatus || "active",
        monitoringActive: account.monitoringStatus === "active",
        lastChecked: account.lastChecked,
      })),
    });
  } catch (error) {
    console.error("[Instagram Dashboard Accounts Error]", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching Instagram accounts",
      error: error.message,
    });
  }
};
