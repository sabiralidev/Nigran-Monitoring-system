const { scrapeProfile, scrapeRecentPosts } = require("../scraper/facebookProfile");

/**
 * Detects the post type based on media content
 * @param {Array} media - The media array from the scraped post
 * @returns {String} - One of: TEXT, IMAGE, VIDEO, CAROUSEL, UNKNOWN
 */
const detectPostType = (media) => {
  if (!media || media.length === 0) {
    return "TEXT";
  }

  const hasVideo = media.some(
    (m) => m.type === "video" || m.video || m.__typename === "Video",
  );
  const hasPhoto = media.some(
    (m) => m.type === "image" || m.type === "photo" || m.photo_image || m.__typename === "Photo",
  );

  if (media.length > 1 && (hasVideo || hasPhoto)) {
    return "CAROUSEL";
  }

  if (hasVideo) return "VIDEO";
  if (hasPhoto) return "IMAGE";

  return "UNKNOWN";
};

const normalizeUsername = (username) => {
  if (!username) return "";

  const raw = String(username).trim();
  const withoutAt = raw.replace(/^@/, "");

  if (/^https?:\/\//i.test(withoutAt)) {
    try {
      const url = new URL(withoutAt);
      const segments = url.pathname.split("/").filter(Boolean);
      return segments[0] || "";
    } catch {
      return "";
    }
  }

  return withoutAt.split("/")[0].replace(/^\/+|\/+$/g, "");
};

const isAuthenticationError = (error) =>
  /authenticated Playwright session|Stored Facebook session is invalid or expired|Facebook login session initialized/i.test(
    error?.message || "",
  );

const triggerApifyActor = async (usernames) => {
  const usernameArray = Array.isArray(usernames) ? usernames : [usernames];
  const normalizedUsernames = usernameArray
    .map(normalizeUsername)
    .filter(Boolean);

  if (normalizedUsernames.length === 0) {
    return [];
  }

  const allPosts = [];

  for (const username of normalizedUsernames) {
    try {
      const profile = await scrapeProfile(username);
      const posts = await scrapeRecentPosts(username, 5);

      const enrichedPosts = posts.map((post) => ({
        ...post,
        sourceUsername: username,
        pageName: username,
        user: {
          username,
          name: profile?.displayName || username,
          profilePic: profile?.profileImage || "",
          photo: profile?.profileImage || "",
        },
      }));

      allPosts.push(...enrichedPosts);
    } catch (error) {
      console.warn(`Could not scrape Facebook account ${username}: ${error.message}`);

      if (isAuthenticationError(error)) {
        console.error(
          "Facebook batch stopped because the stored session is invalid or expired. Log in again before retrying.",
        );
        break;
      }
    }
  }

  return allPosts;
};

module.exports = { triggerApifyActor, detectPostType };
