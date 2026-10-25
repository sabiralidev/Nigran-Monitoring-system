const mongoose = require('mongoose');

const MonitoredAccountSchema = new mongoose.Schema({
  // YouTube Channel Information
  channelId: {
    type: String,
    required: true,
    unique: true,
  },
  channelName: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    required: true,
    default: 'youtube',
  },
  displayName: String,
  profileImage: String,
  description: String,
  subscriberCount: {
    type: Number,
    default: 0,
  },
  videoCount: {
    type: Number,
    default: 0,
  },
  // Uploads Playlist Information
  uploadsPlaylistId: {
    type: String,
  },
  // Last tracked video
  lastVideoId: {
    type: String,
  },
  lastChecked: Date,
  monitoringStatus: {
    type: String,
    enum: ['active', 'paused', 'error'],
    default: 'active',
  },
  alertCount: { type: Number, default: 0 },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('MonitoredAccount', MonitoredAccountSchema);
