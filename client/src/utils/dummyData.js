const dummyAccounts = {
  facebook: [
    { id: 'fb1', username: 'facebook_user_1', displayName: 'Facebook User 1', avatar: '/avatars/avatar-1.png', stats: { followers: '1.2M' } },
    { id: 'fb2', username: 'facebook_user_2', displayName: 'Facebook User 2', avatar: '/avatars/avatar-2.png', stats: { followers: '500K' } },
  ],
  instagram: [
    { id: 'ig1', username: 'insta_user_1', displayName: 'Insta User 1', avatar: '/avatars/avatar-3.png', stats: { followers: '2.5M' } },
  ],
  tiktok: [
    { id: 'tt1', username: 'tiktok_user_1', displayName: 'TikTok User 1', avatar: '/avatars/avatar-4.png', stats: { followers: '10M' } },
    { id: 'tt2', username: 'tiktok_user_2', displayName: 'TikTok User 2', avatar: '/avatars/avatar-5.png', stats: { followers: '5M' } },
    { id: 'tt3', username: 'tiktok_user_3', displayName: 'TikTok User 3', avatar: '/avatars/avatar-6.png', stats: { followers: '2M' } },
  ],
  snapchat: [
    { id: 'sc1', username: 'snap_user_1', displayName: 'Snap User 1', avatar: '/avatars/avatar-7.png', stats: { followers: '1M' } },
  ],
  telegram: [
    { id: 'tg1', username: 'telegram_user_1', displayName: 'Telegram User 1', avatar: '/avatars/avatar-8.png', stats: { followers: '100K' } },
  ],
  bluesky: [
    { id: 'bs1', username: 'bluesky_user_1', displayName: 'BlueSky User 1', avatar: '/avatars/avatar-9.png', stats: { followers: '50K' } },
  ],
  youtube: [
    { id: 'yt1', username: 'youtube_channel_1', displayName: 'YouTube Channel 1', avatar: '/avatars/avatar-10.png', stats: { followers: '5M' } },
    { id: 'yt2', username: 'youtube_channel_2', displayName: 'YouTube Channel 2', avatar: '/avatars/avatar-11.png', stats: { followers: '1M' } },
  ],
  zangi: [
    { id: 'zg1', username: 'zangi_user_1', displayName: 'Zangi User 1', avatar: '/avatars/avatar-12.png', stats: { followers: '10K' } },
  ],
};

const dummyAlerts = {
  facebook: [
    { _id: 'fbalert1', content: 'This is a dummy Facebook alert.', author: 'Facebook User 1', createdAt: new Date().toISOString(), type: 'post' },
    { _id: 'fbalert2', content: 'Another dummy alert for Facebook.', author: 'Facebook User 2', createdAt: new Date().toISOString(), type: 'comment' },
  ],
  instagram: [
    { _id: 'igalert1', content: 'Dummy Instagram alert about a new post.', author: 'Insta User 1', createdAt: new Date().toISOString(), type: 'image' },
  ],
  tiktok: [
    { _id: 'ttalert1', content: 'A viral video has been detected.', author: 'TikTok User 1', createdAt: new Date().toISOString(), type: 'video' },
    { _id: 'ttalert2', content: 'New trend alert!', author: 'TikTok User 2', createdAt: new Date().toISOString(), type: 'video' },
  ],
  snapchat: [
    { _id: 'scalert1', content: 'Snapchat story mention.', author: 'Snap User 1', createdAt: new Date().toISOString(), type: 'story' },
  ],
  telegram: [
    { _id: 'tgalert1', content: 'Message from a monitored Telegram channel.', author: 'Telegram User 1', createdAt: new Date().toISOString(), type: 'message' },
  ],
  bluesky: [
    { _id: 'bsalert1', content: 'A post on BlueSky triggered an alert.', author: 'BlueSky User 1', createdAt: new Date().toISOString(), type: 'post' },
  ],
  youtube: [
    { _id: 'ytalert1', content: 'New video uploaded by a monitored channel.', author: 'YouTube Channel 1', createdAt: new Date().toISOString(), type: 'video' },
    { _id: 'ytalert2', content: 'Comment mention on a YouTube video.', author: 'YouTube Channel 2', createdAt: new Date().toISOString(), type: 'comment' },
  ],
  zangi: [
    { _id: 'zgalert1', content: 'Zangi call detected.', author: 'Zangi User 1', createdAt: new Date().toISOString(), type: 'call' },
  ],
};

export const getPlatformDummyAccounts = (platform) => {
  return dummyAccounts[platform] || [];
};

export const getPlatformDummyAlerts = (platform) => {
  return dummyAlerts[platform] || [];
};
