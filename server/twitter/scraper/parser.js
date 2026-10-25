const parseMetric = (value) => {
  if (!value) return 0;
  const match = value.match(/([\d,.]+)([KMB])?/i);
  if (!match) return 0;

  const amount = Number(match[1].replace(/,/g, ''));
  const multiplier = { k: 1000, m: 1000000, b: 1000000000 }[match[2]?.toLowerCase()] || 1;
  return Math.round(amount * multiplier);
};

const parsePost = (post) => {
  if (!post?.postId) return null;

  return {
    postId: post.postId,
    username: post.username || '',
    text: post.text || '',
    url: post.url,
    postedAt: post.postedAt ? new Date(post.postedAt) : new Date(),
    discoveredAt: new Date(),
    tweetId: post.postId,
    content: post.text || '',
    media: post.media || [],
    activityType: post.activityType || (post.media?.length ? 'image' : 'tweet'),
    retweetedFrom: null,
    replyTo: null,
    quotedTweet: null,
    metrics: post.metrics || { likes: 0, retweets: 0, replies: 0, quotes: 0 },
    tweetCreatedAt: post.postedAt ? new Date(post.postedAt) : new Date(),
    tweetUrl: post.url,
  };
};

const parseProfile = (profile, username) => ({
  twitterId: profile?.twitterId || `x_${username.toLowerCase()}`,
  username: profile?.username || username.toLowerCase(),
  displayName: profile?.displayName || username,
  profileImage: profile?.profileImage || '',
  bio: profile?.bio || '',
  followers: profile?.followers || 0,
  following: profile?.following || 0,
  tweetsCount: profile?.tweetsCount || 0,
  verified: Boolean(profile?.verified),
  location: profile?.location || '',
  website: profile?.website || '',
  accountCreatedAt: profile?.accountCreatedAt || null,
});

const parseMetricValue = parseMetric;

module.exports = { parsePost, parseProfile, parseMetricValue };
