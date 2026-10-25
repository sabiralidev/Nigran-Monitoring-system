const { scrapeProfile, scrapeRecentPosts } = require('../scraper/instagramProfile');
const {
  normalizeInstagramPost,
  detectPostType,
  extractMediaUrl,
  isVideoFileUrl,
} = require('../scraper/parser');
const MonitoredAccount = require('../models/MonitoredAccount');
const Alert = require('../models/Alert');
const { getIO } = require('../socket/socketManager');
const logger = require('../config/logger');

const fetchAccountProfile = async (account) => {
  const profile = await scrapeProfile(account.username);
  return MonitoredAccount.findByIdAndUpdate(account._id, {
    displayName: profile.displayName,
    profileImage: profile.profileImage,
    bio: profile.bio,
    lastChecked: new Date(),
  }, { new: true });
};

const fetchAccountPosts = async (account, limit = 10) => {
  const rawPosts = await scrapeRecentPosts(account.username, limit);
  return rawPosts.map((post) => normalizeInstagramPost(post, account)).filter(Boolean);
};

const saveInstagramPosts = async (account, posts) => {
  const saved = [];
  for (const post of posts) {
    const existing = await Alert.findOne({ platform: 'instagram', postId: post.postId });
    if (existing) {
      const updates = {
        caption: String(post.caption || '').trim(),
        content: String(post.content || '').trim(),
      };
      if (existing.caption !== updates.caption || existing.content !== updates.content) {
        await Alert.findByIdAndUpdate(existing._id, updates);
      }
      continue;
    }

    try {
      const alert = await Alert.create(post);
      await MonitoredAccount.findByIdAndUpdate(account._id, { $inc: { alertCount: 1 } });
      saved.push(alert);
      getIO().emit('new_instagram_alert', alert);
    } catch (error) {
      if (error.code !== 11000) throw error;
      logger.warn(`Instagram post ${post.postId} was inserted concurrently; skipping duplicate`);
    }
  }
  return saved;
};

const fetchAndSaveAccountPosts = async (account, limit = 10) => {
  const fetchedPosts = await fetchAccountPosts(account, Math.max(limit, 30));
  const checkpointIndex = account.lastPostId
    ? fetchedPosts.findIndex((post) => post.postId === account.lastPostId)
    : -1;
  const posts = (checkpointIndex >= 0 ? fetchedPosts.slice(0, checkpointIndex) : fetchedPosts)
    .slice(0, limit);
  const saved = await saveInstagramPosts(account, posts);
  await MonitoredAccount.findByIdAndUpdate(account._id, {
    lastChecked: new Date(),
    monitoringStatus: 'active',
    ...(fetchedPosts[0] ? { lastPostId: fetchedPosts[0].postId } : {}),
  });
  return { posts, saved };
};

module.exports = {
  fetchAccountProfile,
  fetchAccountPosts,
  fetchAndSaveAccountPosts,
  saveInstagramPosts,
  scrapeProfile,
  scrapeRecentPosts,
  detectPostType,
  extractMediaUrl,
  isVideoFileUrl,
};
