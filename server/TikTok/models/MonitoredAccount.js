const mongoose = require("mongoose");

const MonitoredAccountSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  platform: {
    type: String,
    required: true,
    default: "tiktok",
  },
  displayName: String,
  profileImage: String,
  bio: String,
  profileUrl: String,
  verified: {
    type: Boolean,
    default: false,
  },
  followers: {
    type: Number,
    default: 0,
  },
  following: {
    type: Number,
    default: 0,
  },
  hearts: {
    type: Number,
    default: 0,
  },
  videoCount: {
    type: Number,
    default: 0,
  },
  monitoringStatus: {
    type: String,
    enum: ["active", "paused", "error"],
    default: "active",
  },
  lastChecked: Date,
  alertCount: { type: Number, default: 0 },
});

module.exports = mongoose.model("MonitoredAccount", MonitoredAccountSchema);
