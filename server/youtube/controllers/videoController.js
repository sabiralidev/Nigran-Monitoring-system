const Alert = require("../models/Alert");
const MonitoredAccount = require("../models/MonitoredAccount");

/**
 * Get all videos (alerts) for all channels
 * GET /videos
 */
exports.getAllVideos = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const videos = await Alert.find({ platform: "youtube" })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Alert.countDocuments({ platform: "youtube" });

    res.json({
      success: true,
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Error fetching videos:", err);
    res.status(500).json({ msg: "Server error while fetching videos" });
  }
};

/**
 * Get videos for a specific channel
 * GET /videos/channel/:channelId
 */
exports.getVideosByChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const videos = await Alert.find({
      channelId,
      platform: "youtube",
    })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Alert.countDocuments({
      channelId,
      platform: "youtube",
    });

    res.json({
      success: true,
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Error fetching channel videos:", err);
    res.status(500).json({ msg: "Server error while fetching channel videos" });
  }
};

/**
 * Get a specific video by ID
 * GET /videos/:videoId
 */
exports.getVideoById = async (req, res) => {
  try {
    const { videoId } = req.params;

    // Try to find by _id first (for MongoDB ObjectId), then by videoId
    let video = await Alert.findOne({
      _id: videoId,
      platform: "youtube",
    });

    if (!video) {
      video = await Alert.findOne({
        videoId,
        platform: "youtube",
      });
    }

    if (!video) {
      return res.status(404).json({ msg: "Video not found" });
    }

    res.json({ success: true, video });
  } catch (err) {
    console.error("Error fetching video:", err);
    res.status(500).json({ msg: "Server error while fetching video" });
  }
};

/**
 * Mark a video as viewed
 * PATCH /videos/:videoId/viewed
 */
exports.markVideoAsViewed = async (req, res) => {
  try {
    const { videoId } = req.params;

    // Try to find by _id first (for MongoDB ObjectId), then by videoId
    let video = await Alert.findOne({ _id: videoId, platform: "youtube" });

    if (!video) {
      video = await Alert.findOne({ videoId, platform: "youtube" });
    }

    if (!video) {
      return res.status(404).json({ msg: "Video not found" });
    }

    // Update the video
    video.isViewed = true;
    video.isRead = true;
    video = await video.save();

    res.json({ success: true, video });
  } catch (err) {
    console.error("Error marking video as viewed:", err);
    res.status(500).json({ msg: "Server error while marking video as viewed" });
  }
};

/**
 * Mark all videos as viewed
 * PATCH /videos/mark-all-viewed
 */
exports.markAllVideosAsViewed = async (req, res) => {
  try {
    const result = await Alert.updateMany(
      { platform: "youtube" },
      { $set: { isViewed: true, isRead: true } },
    );

    res.json({
      success: true,
      message: "All videos marked as viewed",
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Error marking all videos as viewed:", err);
    res
      .status(500)
      .json({ msg: "Server error while marking all videos as viewed" });
  }
};

/**
 * Get videos statistics
 * GET /videos/stats
 */
exports.getVideoStats = async (req, res) => {
  try {
    const totalVideos = await Alert.countDocuments({ platform: "youtube" });
    const viewedVideos = await Alert.countDocuments({
      platform: "youtube",
      isViewed: true,
    });
    const unviewedVideos = totalVideos - viewedVideos;

    const topVideos = await Alert.find({ platform: "youtube" })
      .sort({ viewCount: -1 })
      .limit(10);

    res.json({
      success: true,
      stats: {
        totalVideos,
        viewedVideos,
        unviewedVideos,
        topVideos,
      },
    });
  } catch (err) {
    console.error("Error fetching video statistics:", err);
    res
      .status(500)
      .json({ msg: "Server error while fetching video statistics" });
  }
};
