const mongoose = require('mongoose');

const monitoredAccountSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Twitter username is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    twitterId: {
      type: String,
      required: true,
      unique: true,
    },
    displayName: {
      type: String,
      default: '',
    },
    profileImage: {
      type: String,
      default: '',
    },
    profileBanner: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
    },
    followers: {
      type: Number,
      default: 0,
    },
    following: {
      type: Number,
      default: 0,
    },
    tweetsCount: {
      type: Number,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    location: {
      type: String,
      default: '',
    },
    website: {
      type: String,
      default: '',
    },
    accountCreatedAt: {
      type: Date,
      default: null,
    },
    monitoringStatus: {
      type: String,
      enum: ['active', 'paused', 'error'],
      default: 'active',
    },
    lastChecked: {
      type: Date,
      default: null,
    },
    lastTweetId: {
      type: String,
      default: null,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    alertCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

monitoredAccountSchema.index({ monitoringStatus: 1 });

module.exports = mongoose.model('MonitoredAccount', monitoredAccountSchema);
