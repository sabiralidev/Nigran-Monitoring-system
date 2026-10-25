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
  },
  source: {
    // The user/account that was being monitored
    type: String,
    required: true,
  },
  // Author information (who posted the content)
  authorUsername: {
    type: String,
  },
  authorDisplayName: {
    type: String,
  },
  authorId: {
    type: String,
  },
  profileImage: {
    type: String,
  },
  // Post information
  postId: {
    type: String,
    sparse: true,
    unique: true,
  },
  shortCode: {
    type: String,
  },
  caption: {
    type: String,
  },
  content: {
    type: String,
  },
  url: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["Image", "Video", "Carousel", "TEXT"],
    default: "Image",
  },
  postType: {
    type: String,
    enum: ["TEXT", "IMAGE", "VIDEO", "CAROUSEL", "UNKNOWN"],
    default: "TEXT",
  },
  // Media information
  displayUrl: {
    type: String,
  },
  videoUrl: {
    type: String,
  },
  images: {
    type: Array,
  },
  dimensionsHeight: Number,
  dimensionsWidth: Number,
  alt: String,
  // Engagement metrics
  likesCount: {
    type: Number,
    default: 0,
  },
  commentsCount: {
    type: Number,
    default: 0,
  },
  latestComments: {
    type: Array,
    default: [],
  },
  isCommentsDisabled: {
    type: Boolean,
    default: false,
  },
  // Hashtags and mentions
  hashtags: {
    type: Array,
    default: [],
  },
  mentions: {
    type: Array,
    default: [],
  },
  // Relationships
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MonitoredAccount",
    required: true,
  },
  timestamp: Date,
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Alert", AlertSchema);
