const mongoose = require('mongoose');

const platformDataSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      required: true,
      enum: ['facebook', 'youtube', 'instagram', 'tiktok', 'telegram', 'snapchat', 'bluesky', 'zangi'],
    },
    externalId: { type: String, required: true },
    authorUsername: { type: String, default: '' },
    authorDisplayName: { type: String, default: '' },
    authorAvatar: { type: String, default: '' },
    content: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    postUrl: { type: String, default: '' },
    postType: {
      type: String,
      enum: ['post', 'video', 'reel', 'story', 'comment', 'message', 'other'],
      default: 'post',
    },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    sentiment: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
      default: 'neutral',
    },
    sentimentScore: { type: Number, default: 0 },
    keywords: [{ type: String }],
    isRead: { type: Boolean, default: false },
    postedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

platformDataSchema.index({ platform: 1, externalId: 1 }, { unique: true });
platformDataSchema.index({ platform: 1, createdAt: -1 });

module.exports = mongoose.model('PlatformData', platformDataSchema);
