const cron = require("node-cron");
const MonitoredAccount = require("../models/MonitoredAccount");
const Alert = require("../models/Alert");
const {
  triggerApifyActor,
  detectPostType,
  extractSlideshowImages,
  toDateFromApifyItem,
  normalizeUsername,
  extractActorUsername,
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
    authorDisplayName:
      item?.authorMeta?.nickName || account.displayName || account.username,
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

const findMatchingAccount = (item, accountMap) => {
  const sourceUsername = extractActorUsername(item);
  const candidateKeys = [];

  if (sourceUsername) {
    candidateKeys.push(sourceUsername.toLowerCase());
  }

  if (item?.authorMeta?.name) {
    candidateKeys.push(item.authorMeta.name.toLowerCase());
  }

  if (item?.authorMeta?.id) {
    candidateKeys.push(item.authorMeta.id.toLowerCase());
  }

  for (const key of candidateKeys) {
    if (accountMap[key]) {
      return accountMap[key];
    }
  }

  return null;
};

const fetchLatestPosts = async () => {
  console.log("Running job: Fetching latest posts for all accounts.");
  try {
    const accounts = await MonitoredAccount.find({ platform: "tiktok" });
    if (!accounts || accounts.length === 0) {
      console.log("No accounts to monitor.");
      return;
    }

    const accountMap = {};
    accounts.forEach((account) => {
      const key = normalizeUsername(account.username);
      if (key) {
        accountMap[key.toLowerCase()] = account;
      }
    });

    const usernames = accounts
      .map((account) => account.username)
      .filter(Boolean);

    const items = await triggerApifyActor(usernames, { resultsPerPage: 1 });
    const itemArray = Array.isArray(items) ? items : [];
    const processedAccountIds = new Set();

    for (const item of itemArray) {
      if (!item || item.error) {
        continue;
      }

      const matchedAccount = findMatchingAccount(item, accountMap);
      if (!matchedAccount) {
        console.log("No monitored account matched returned post:", {
          sourceUsername: extractActorUsername(item),
          authorName: item?.authorMeta?.name || null,
          postId: item?.id || null,
        });
        continue;
      }

      processedAccountIds.add(String(matchedAccount._id));

      console.log("Matched monitored account:", {
        matchedUsername: matchedAccount.username,
        sourceUsername: extractActorUsername(item),
        postId: item?.id || null,
      });

      try {
        await MonitoredAccount.updateOne(
          { _id: matchedAccount._id },
          { lastChecked: new Date(), monitoringStatus: "active" },
        );

        const existingAlert = await Alert.findOne({ postId: item.id });
        if (existingAlert) {
          console.log(`Post ${item.id} already exists. Skipping.`);
          continue;
        }

        const alertData = mapItemToAlert(item, matchedAccount);
        if (!alertData.url) {
          continue;
        }

        const newAlert = new Alert(alertData);
        const savedAlert = await newAlert.save();
        console.log("New post saved as alert:", savedAlert._id);

        await MonitoredAccount.updateOne(
          { _id: matchedAccount._id },
          { $inc: { alertCount: 1 } },
        );

        const io = getIO();
        io.emit("new_tiktok_alert", savedAlert);
      } catch (accountError) {
        console.error(
          `Error processing TikTok post for ${matchedAccount.username}:`,
          accountError,
        );
        await MonitoredAccount.updateOne(
          { _id: matchedAccount._id },
          { monitoringStatus: "error", lastChecked: new Date() },
        );
      }
    }

    for (const account of accounts) {
      if (processedAccountIds.has(String(account._id))) {
        continue;
      }

      await MonitoredAccount.updateOne(
        { _id: account._id },
        { lastChecked: new Date() },
      );
    }
  } catch (error) {
    console.error("Error during post fetching:", error);
  }
};

const startMonitoring = () => {
  fetchLatestPosts();
  cron.schedule("*/30 * * * *", fetchLatestPosts);
};

module.exports = { startMonitoring };
