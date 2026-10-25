const Alert = require("../models/Alert");
const MonitoredAccount = require("../models/MonitoredAccount");

const enrichAlertProfileImage = (alertDoc) => {
  const accountProfileImage = alertDoc?.accountId?.profileImage || "";
  return {
    ...alertDoc,
    profileImage: alertDoc.profileImage || accountProfileImage || alertDoc.displayUrl || "",
    authorDisplayName:
      alertDoc.authorDisplayName ||
      alertDoc?.accountId?.displayName ||
      alertDoc.authorUsername ||
      alertDoc.source,
  };
};

// @desc    Get all alerts with pagination
// @route   GET /api/v1/alerts
// @access  Public
exports.getAlerts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sort = "newest" } = req.query;
    const skip = (page - 1) * limit;

    const query = { platform: "instagram" };

    const [alerts, total] = await Promise.all([
      Alert.find(query)
        .sort({
          createdAt: sort === "newest" ? -1 : 1,
          timestamp: sort === "newest" ? -1 : 1,
        })
        .skip(skip)
        .limit(Number(limit))
        .populate("accountId", "profileImage displayName username")
        .lean(),
      Alert.countDocuments(query),
    ]);

    const pages = Math.max(1, Math.ceil(total / limit));

    res.status(200).json({
      success: true,
      alerts: alerts.map(enrichAlertProfileImage),
      pagination: {
        total,
        page: Number(page),
        pages,
        limit: Number(limit),
        hasMore: Number(page) < pages,
      },
    });
  } catch (err) {
    console.error("Error fetching alerts:", err);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Get single alert
// @route   GET /api/v1/alerts/:id
// @access  Public
exports.getAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true },
    )
      .populate("accountId", "profileImage displayName username")
      .lean();
    if (!alert) {
      return res.status(404).json({ success: false, error: "Alert not found" });
    }
    
    // Log media fields for debugging
    console.log(`Alert ${req.params.id} media info:`, {
      displayUrl: alert.displayUrl ? "exists" : "missing",
      images: alert.images ? `array with ${alert.images.length} items` : "missing",
      type: alert.type,
      postType: alert.postType,
    });
    
    res.status(200).json({
      success: true,
      alert: enrichAlertProfileImage(alert),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Mark all alerts as read
// @route   PUT /alerts/mark-all-read
// @access  Public
exports.markAllAlertsRead = async (req, res, next) => {
  try {
    const result = await Alert.updateMany(
      { platform: "instagram", isRead: false },
      { isRead: true },
    );
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} alerts marked as read`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Mark single alert as viewed
// @route   PUT /alerts/:id/viewed
// @access  Public
exports.markOneViewed = async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true },
    )
      .populate("accountId", "profileImage displayName username")
      .lean();
    if (!alert) {
      return res
        .status(404)
        .json({ success: false, message: "Alert not found" });
    }
    res.status(200).json({
      success: true,
      message: "Alert marked as viewed",
      alert: enrichAlertProfileImage(alert),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
