const { cleanUsername } = require('./instagramProfile');

const isVideoFileUrl = (url) => typeof url === 'string' && /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(url);

const detectPostType = (type) => {
  const value = String(type || '').toUpperCase();
  if (value === 'VIDEO' || value === 'GRAPHVIDEO') return 'VIDEO';
  if (value === 'CAROUSEL' || value === 'SIDECAR' || value === 'GRAPHSIDECAR') return 'CAROUSEL';
  if (value === 'IMAGE' || value === 'GRAPHIMAGE') return 'IMAGE';
  return value ? 'UNKNOWN' : 'TEXT';
};

const extractMediaUrl = (item) => {
  if (typeof item === 'string') return item;
  return item?.imageUrl || item?.displayUrl || item?.thumbnailUrl || item?.url || '';
};

const cleanInstagramCaption = (value) => String(value || '')
  .replace(/^\s*\d[\d,.\s]*\s+likes?,\s*\d[\d,.\s]*\s+comments?\s*-\s*[^:]+:\s*/i, '')
  .trim();

const normalizeInstagramPost = (post, account) => {
  const postId = String(post?.postId || post?.id || post?.shortCode || '').trim();
  if (!postId) return null;
  const postType = detectPostType(post.type);
  const images = Array.isArray(post.images) ? post.images.map(extractMediaUrl).filter(Boolean) : [];
  const displayUrl = postType === 'CAROUSEL' ? images[0] || post.displayUrl || '' : post.displayUrl || '';
  const videoUrl = post.videoUrl || (isVideoFileUrl(post.displayUrl) ? post.displayUrl : '') || undefined;
  return {
    platform: 'instagram',
    source: account.username,
    authorUsername: post.ownerUsername || post.username || account.username,
    authorDisplayName: post.ownerFullName || post.ownerUsername || account.displayName || account.username,
    authorId: post.ownerId || '',
    profileImage: account.profileImage || post.ownerProfilePic || displayUrl,
    postId,
    shortCode: post.shortCode || postId,
    caption: cleanInstagramCaption(post.caption || post.text || ''),
    content: cleanInstagramCaption(post.content || ''),
    url: post.url || `https://www.instagram.com/p/${postId}/`,
    type: postType === 'VIDEO' ? 'Video' : postType === 'CAROUSEL' ? 'Carousel' : postType === 'TEXT' ? 'TEXT' : 'Image',
    postType,
    displayUrl,
    videoUrl,
    images,
    dimensionsHeight: post.dimensionsHeight,
    dimensionsWidth: post.dimensionsWidth,
    alt: post.alt || '',
    likesCount: Number(post.likesCount) || 0,
    commentsCount: Number(post.commentsCount) || 0,
    latestComments: Array.isArray(post.latestComments) ? post.latestComments : [],
    isCommentsDisabled: Boolean(post.isCommentsDisabled),
    hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
    mentions: Array.isArray(post.mentions) ? post.mentions : [],
    accountId: account._id,
    timestamp: post.timestamp || (post.postedAt ? new Date(post.postedAt) : new Date()),
  };
};

module.exports = { normalizeInstagramPost, detectPostType, extractMediaUrl, isVideoFileUrl, cleanUsername };
