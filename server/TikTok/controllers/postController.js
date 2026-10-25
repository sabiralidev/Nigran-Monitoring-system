const MonitoredAccount = require("../models/MonitoredAccount");
const Alert = require("../models/Alert");
const {
  triggerApifyActor,
  detectPostType,
  extractSlideshowImages,
  toDateFromApifyItem,
} = require("../services/tiktokService");
const { getIO } = require("../socket/socketManager");

const mapItemToAlert = (item, account) => {
  const postType = detectPostType(item);
  const images = postType === "CAROUSEL" ? extractSlideshowImages(item) : [];
  const displayUrl =
    (postType === "CAROUSEL" ? images[0] : null) ||
    item?.videoMeta?.coverUrl ||
    item?.videoMeta?.originalCoverUrl ||
    "";
  const videoUrl =
    item?.videoMeta?.downloadAddr ||
    (Array.isArray(item?.mediaUrls) ? item.mediaUrls[0] : null) ||
    "";

  return {
    platform: "tiktok",
    source: account.username,
    authorUsername: item?.authorMeta?.name || account.username,
    authorDisplayName: item?.authorMeta?.nickName || account.displayName || account.username,
    authorProfilePic: item?.authorMeta?.avatar || account.profileImage || "",
    postId: item?.id,
    content: item?.text || "",
    url: item?.webVideoUrl || item?.submittedVideoUrl || item?.input || "",
    postType,
    displayUrl,
    videoUrl: postType === "VIDEO" ? videoUrl : "",
    images,
    isSlideshow: !!item?.isSlideshow,
    duration: item?.videoMeta?.duration,
    likesCount: item?.diggCount || 0,
    sharesCount: item?.shareCount || 0,
    commentsCount: item?.commentCount || 0,
    viewsCount: item?.playCount || 0,
    collectsCount: item?.collectCount || 0,
    repostCount: item?.repostCount || 0,
    hashtags: Array.isArray(item?.hashtags)
      ? item.hashtags.map((h) => h?.name).filter(Boolean)
      : [],
    mentions: Array.isArray(item?.mentions)
      ? item.mentions.map((m) => String(m).replace(/^@/, "")).filter(Boolean)
      : [],
    musicMeta: item?.musicMeta || undefined,
    accountId: account._id,
    timestamp: toDateFromApifyItem(item),
  };
};

const fetchAndSavePosts = async (req, res) => {
  try {
    const { accountId } = req.params;
    const account = await MonitoredAccount.findById(accountId);

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const posts = await triggerApifyActor(account.username, { resultsPerPage: 1 });
    const validItems = Array.isArray(posts) ? posts.filter((p) => p && !p.error) : [];

    if (validItems.length > 0) {
      const alertData = validItems
        .map((item) => mapItemToAlert(item, account))
        .filter((a) => a.url && a.postId);

      const savedAlerts = await Alert.insertMany(alertData, { ordered: false });

      if (savedAlerts.length > 0) {
        await MonitoredAccount.updateOne(
          { _id: accountId },
          { $inc: { alertCount: savedAlerts.length }, lastChecked: new Date() },
        );

        const io = getIO();
        savedAlerts.forEach((alert) => {
          io.emit("new_tiktok_alert", alert);
        });
      }

      return res.status(201).json(savedAlerts);
    }

    return res.status(200).json({ message: "No new posts found." });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({ message: "Posts already exist." });
    }
    console.error("Error fetching and saving posts:", error);
    return res.status(500).json({ message: "Error fetching and saving posts" });
  }
};

const getPostsForAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const alerts = await Alert.find({
      accountId: accountId,
      platform: "tiktok",
    }).sort({ timestamp: -1 });
    res.status(200).json(alerts);
  } catch (error) {
    console.error("Error getting posts:", error);
    res.status(500).json({ message: "Error getting posts" });
  }
};

module.exports = {
  fetchAndSavePosts,
  getPostsForAccount,
};

