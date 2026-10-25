const { ApifyClient } = require("apify-client");
const MonitoredAccount = require("../models/MonitoredAccount");

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

const normalizeUsername = (value) => {
  if (!value || typeof value !== "string") return "";
  return value.trim().replace(/^@/, "");
};

const normalizeUsernames = (valueOrValues) => {
  const values = Array.isArray(valueOrValues) ? valueOrValues : [valueOrValues];

  return values
    .filter((value) => value !== undefined && value !== null)
    .map((value) => normalizeUsername(String(value)))
    .filter(Boolean);
};

const extractActorUsername = (item) => {
  const candidates = [
    item?.authorMeta?.name,
    item?.authorMeta?.id,
    item?.input,
    item?.authorMeta?.profileUrl,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return normalizeUsername(candidate);
    }
  }

  return "";
};

const parseTikTokProfileInput = (rawInput) => {
  const input = String(rawInput || "").trim();
  if (!input) return { username: "", isValid: false };

  const usernamePattern = /^[A-Za-z0-9._]{2,50}$/;

  const looksLikeUrl =
    input.startsWith("http://") ||
    input.startsWith("https://") ||
    input.includes("tiktok.com/");

  if (!looksLikeUrl) {
    const username = normalizeUsername(input);
    return { username, isValid: usernamePattern.test(username) };
  }

  let url;
  try {
    url = new URL(input.startsWith("http") ? input : `https://${input}`);
  } catch {
    return { username: "", isValid: false };
  }

  const host = (url.hostname || "").toLowerCase();
  if (!host.includes("tiktok.com")) {
    return { username: "", isValid: false };
  }

  const match = url.pathname.match(/\/@([^/]+)/);
  if (!match) return { username: "", isValid: false };

  const username = normalizeUsername(match[1]);
  return { username, isValid: usernamePattern.test(username) };
};

const toDateFromApifyItem = (item) => {
  if (!item) return new Date();
  if (item.createTimeISO) {
    const d = new Date(item.createTimeISO);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof item.createTime === "number") {
    const d = new Date(item.createTime * 1000);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
};

const extractSlideshowImages = (item) => {
  const links = Array.isArray(item?.slideshowImageLinks)
    ? item.slideshowImageLinks
    : [];
  const urls = [];
  links.forEach((entry) => {
    const candidate =
      entry?.downloadLink || entry?.tiktokLink || entry?.url || null;
    if (
      candidate &&
      typeof candidate === "string" &&
      !urls.includes(candidate)
    ) {
      urls.push(candidate);
    }
  });
  return urls;
};

const detectPostType = (item) => {
  if (!item) return "UNKNOWN";
  if (
    item.isSlideshow ||
    (Array.isArray(item.slideshowImageLinks) &&
      item.slideshowImageLinks.length > 0)
  ) {
    return "CAROUSEL";
  }
  return "VIDEO";
};

const triggerApifyActor = async (usernameOrUsernames, options = {}) => {
  const actorId = "clockworks/tiktok-scraper";
  const usernames = normalizeUsernames(usernameOrUsernames);

  if (usernames.length === 0) {
    return [];
  }

  const resultsPerPage = Math.max(
    1,
    Math.min(Number(options.resultsPerPage || 1), 10),
  );
  const input = {
    commentsPerPost: 0,
    excludePinnedPosts: true,
    maxFollowersPerProfile: 0,
    maxFollowingPerProfile: 0,
    maxRepliesPerComment: 0,
    profiles: usernames,
    proxyCountryCode: "None",
    resultsPerPage,
    scrapeAdditionalAuthorMeta: false,
    scrapeRelatedSearchWords: false,
    scrapeRelatedVideos: false,
    shouldDownloadAvatars: false,
    shouldDownloadCovers: false,
    shouldDownloadMusicCovers: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadVideos: false,
    topLevelCommentsPerPost: 0,
  };

  console.log("Usernames sent to the actor:", usernames);
  console.log("Number of usernames:", usernames.length);
  console.log("Apify TikTok input:", JSON.stringify(input, null, 2));

  try {
    const run = await apifyClient.actor(actorId).start(input);
    console.log("Actor run started:", run.id);

    const finishedRun = await apifyClient.run(run.id).waitForFinish({
      waitSecs: 60,
    });
    console.log("Actor run finished:", finishedRun.id);

    const { items } = await apifyClient
      .dataset(finishedRun.defaultDatasetId)
      .listItems();

    const itemArray = Array.isArray(items) ? items : [];

    console.log("=== RAW DATA FROM APIFY ACTOR ===");
    console.log("Total posts returned:", itemArray.length);
    if (itemArray.length > 0) {
      console.log(
        "First returned object:",
        JSON.stringify(itemArray[0], null, 2),
      );
    }

    const itemsWithSource = itemArray.map((item) => ({
      ...item,
      sourceUsername: extractActorUsername(item),
    }));

    console.log(
      "Username/profile identifier extracted from every returned post:",
      itemsWithSource.map((item) => ({
        sourceUsername: item.sourceUsername,
        authorName: item?.authorMeta?.name || null,
        authorId: item?.authorMeta?.id || null,
        postId: item?.id || null,
      })),
    );

    if (usernames.length === 1) {
      const [targetUsername] = usernames;
      const firstItem = itemsWithSource[0];

      if (firstItem?.authorMeta) {
        const meta = firstItem.authorMeta;
        const displayName = meta.nickName || targetUsername;
        const profileImage = meta.avatar || meta.originalAvatarUrl;
        const bio = meta.signature || "";
        const profileUrl =
          meta.profileUrl || `https://www.tiktok.com/@${targetUsername}`;
        const verified = !!meta.verified;

        await MonitoredAccount.updateOne(
          { username: targetUsername, platform: "tiktok" },
          {
            displayName,
            profileImage,
            bio,
            profileUrl,
            verified,
            followers: meta.fans || 0,
            following: meta.following || 0,
            hearts: meta.heart || 0,
            videoCount: meta.video || 0,
            lastChecked: new Date(),
          },
          { upsert: false },
        );
      }
    }

    return itemsWithSource;
  } catch (error) {
    console.error("Error triggering Apify actor:", error);
    throw error;
  }
};

module.exports = {
  triggerApifyActor,
  parseTikTokProfileInput,
  normalizeUsername,
  normalizeUsernames,
  detectPostType,
  extractActorUsername,
  extractSlideshowImages,
  toDateFromApifyItem,
};
