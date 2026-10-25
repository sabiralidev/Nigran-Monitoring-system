const mongoose = require('mongoose');

const keywordSchema = new mongoose.Schema(
  {
    word: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    platforms: {
      type: [String],
      default: ['all'],
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Keyword', keywordSchema);
