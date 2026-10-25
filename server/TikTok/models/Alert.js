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
    type: String,
    required: true,
  },
  authorUsername: {
    type: String,
  },
  authorDisplayName: {
    type: String,
  },
  authorProfilePic: {
    type: String,
  },
  postId: {
    type: String,
    sparse: true,
    unique: true,
  },
  content: {
    type: String,
  },
  url: {
    type: String,
    required: true,
  },
  postType: {
    type: String,
    enum: ["TEXT", "IMAGE", "VIDEO", "CAROUSEL", "UNKNOWN"],
    default: "VIDEO",
  },
  displayUrl: {
    type: String,
  },
  videoUrl: {
    type: String,
  },
  images: {
    type: Array,
    default: [],
  },
  isSlideshow: {
    type: Boolean,
    default: false,
  },
  duration: {
    type: Number,
  },
  likesCount: {
    type: Number,
    default: 0,
  },
  sharesCount: {
    type: Number,
    default: 0,
  },
  commentsCount: {
    type: Number,
    default: 0,
  },
  viewsCount: {
    type: Number,
    default: 0,
  },
  collectsCount: {
    type: Number,
    default: 0,
  },
  repostCount: {
    type: Number,
    default: 0,
  },
  hashtags: {
    type: Array,
    default: [],
  },
  mentions: {
    type: Array,
    default: [],
  },
  musicMeta: {
    type: Object,
  },
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
