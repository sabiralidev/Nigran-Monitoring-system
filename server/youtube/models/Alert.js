const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: [
      "twitter",
      "facebook",
      "instagram",
      "youtube",
      "telegram",
      "snapchat",
      "tiktok",
      "zangi",
      "bluesky",
    ],
    default: "youtube",
  },
  // Channel being monitored
  source: {
    type: String,
    required: true,
  },
  // Video Information
  videoId: {
    type: String,
    required: true,
    unique: true,
  },
  videoTitle: {
    type: String,
    required: true,
  },
  videoDescription: String,
  thumbnail: String,
  channelId: String,
  channelName: String,
  channelProfileImage: String,

  // Channel Account Reference
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MonitoredAccount",
  },

  // Video Stats
  viewCount: {
    type: Number,
    default: 0,
  },
  likeCount: {
    type: Number,
    default: 0,
  },
  commentCount: {
    type: Number,
    default: 0,
  },

  // URL to the video
  url: {
    type: String,
    required: true,
  },

  // Published time
  publishedAt: {
    type: Date,
    required: true,
  },

  // Status tracking
  isRead: {
    type: Boolean,
    default: false,
  },
  isViewed: {
    type: Boolean,
    default: false,
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Alert", AlertSchema);
