const mongoose = require('mongoose');

const MonitoredAccountSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  platform: {
    type: String,
    required: true,
    default: 'facebook',
  },
  displayName: String,
  profileImage: String,
  bio: String,
  monitoringStatus: {
    type: String,
    enum: ['active', 'paused', 'error'],
    default: 'active',
  },
  lastChecked: Date,
  alertCount: { type: Number, default: 0 },
});

module.exports = mongoose.model('MonitoredAccount', MonitoredAccountSchema);
