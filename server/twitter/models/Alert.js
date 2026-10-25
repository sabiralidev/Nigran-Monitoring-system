const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MonitoredAccount',
      required: false,
    },
    platform: {
      type: String,
      enum: ['twitter', 'facebook', 'instagram', 'youtube', 'tiktok', 'telegram', 'snapchat', 'bluesky', 'zangi'],
      default: 'twitter',
      required: true,
      lowercase: true,
    },
    externalId: {
      type: String,
      required: false,
    },
    username: {
      type: String,
      required: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      default: '',
    },
    profileImage: {
      type: String,
      default: '',
    },
    tweetId: {
      type: String,
      required: false,
    },
    content: {
      type: String,
      default: '',
    },
    media: [
      {
        type: {
          type: String,
          enum: ['photo', 'video', 'animated_gif'],
        },
        url: String,
        previewUrl: String,
        width: Number,
        height: Number,
      },
    ],
    tweetUrl: {
      type: String,
      required: false,
      default: '',
    },
    sourceUrl: {
      type: String,
      default: '',
    },
    activityType: {
      type: String,
      enum: ['tweet', 'retweet', 'reply', 'thread', 'image', 'video', 'quote'],
      required: true,
    },
    retweetedFrom: {
      type: String,
      default: null,
    },
    replyTo: {
      type: String,
      default: null,
    },
    quotedTweet: {
      id: String,
      text: String,
      url: String,
    },
    metrics: {
      likes: { type: Number, default: 0 },
      retweets: { type: Number, default: 0 },
      replies: { type: Number, default: 0 },
      quotes: { type: Number, default: 0 },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isViewed: {
      type: Boolean,
      default: false,
    },
    tweetCreatedAt: {
      type: Date,
      required: false,
    },
    sourceCreatedAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

alertSchema.index({ accountId: 1, createdAt: -1 });

alertSchema.index({ isRead: 1 });
alertSchema.index({ isViewed: 1 });
alertSchema.index({ activityType: 1 });
alertSchema.index({ platform: 1, createdAt: -1 });
alertSchema.index({ platform: 1, externalId: 1 }, { unique: true, sparse: true });
alertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
