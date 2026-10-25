const { scrapeProfile, scrapeRecentPosts } = require('../scraper/xProfile');
const { parsePost, parseProfile } = require('../scraper/parser');

const getUserProfile = async (username) => {
  const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
  return parseProfile(await scrapeProfile(cleanUsername), cleanUsername);
};

const getLatestTweets = async (username, sinceId = null, maxResults = 20) => {
  const posts = await scrapeRecentPosts(username, maxResults);
  const normalized = posts.map(parsePost).filter(Boolean);

  if (!sinceId) return normalized;

  let sinceNumber = null;
  try {
    sinceNumber = BigInt(sinceId);
  } catch {
    sinceNumber = null;
  }

  return normalized.filter((post) => {
    if (!sinceNumber) return post.tweetId !== sinceId;
    try {
      return BigInt(post.tweetId) > sinceNumber;
    } catch {
      return post.tweetId !== sinceId;
    }
  });
};

module.exports = {
  getUserProfile,
  getLatestTweets,
  testCredentials: async () => true,
  isApiUnavailable: () => false,
};
