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
  authorProfilePic: {
    type: String,
  },
  content: {
    type: String,
  },
  profilePic: {
    type: String,
  },
  media: {
    type: Array,
  },
  postType: {
    type: String,
    enum: ["TEXT", "IMAGE", "VIDEO", "CAROUSEL", "UNKNOWN"],
    default: "TEXT",
  },
  url: {
    type: String,
    required: true,
  },
  postId: {
    type: String,
    unique: true,
    sparse: true,
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MonitoredAccount",
  },
  likes: {
    type: Number,
    default: 0,
  },
  shares: {
    type: Number,
    default: 0,
  },
  comments: {
    type: Number,
    default: 0,
  },
  mediaUrl: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  // You can add more fields specific to alerts here
});

module.exports = mongoose.model("Alert", AlertSchema);
