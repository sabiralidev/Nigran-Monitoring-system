const Alert = require("../models/Alert");

const enrichAlertProfile = (alertDoc) => {
  const accountProfileImage = alertDoc?.accountId?.profileImage || "";
  const accountDisplayName =
    alertDoc?.accountId?.displayName || alertDoc?.accountId?.username || "";

  return {
    ...alertDoc,
    authorProfilePic: alertDoc.authorProfilePic || accountProfileImage || "",
    authorDisplayName:
      alertDoc.authorDisplayName ||
      accountDisplayName ||
      alertDoc.authorUsername ||
      alertDoc.source,
  };
};

exports.getAlerts = async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = "newest" } = req.query;
    const skip = (page - 1) * limit;

    const query = { platform: "tiktok" };

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
      alerts: alerts.map(enrichAlertProfile),
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

exports.getAlert = async (req, res) => {
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

    res.status(200).json({
      success: true,
      alert: enrichAlertProfile(alert),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

exports.markAllAlertsRead = async (req, res) => {
  try {
    const result = await Alert.updateMany(
      { platform: "tiktok", isRead: false },
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

exports.markOneViewed = async (req, res) => {
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
      alert: enrichAlertProfile(alert),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

