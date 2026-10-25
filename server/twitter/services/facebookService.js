const logger = require('../config/logger');

const PLATFORM = 'facebook';

const getFacebookStats = async (options = {}) => {
  logger.info(`[${PLATFORM}] Stats requested - API integration pending`);
  return {
    mentions: 1240,
    engagement: 890,
    sentiment: { positive: 31, negative: 19, neutral: 50 },
  };
};

const getFacebookMentions = async (options = {}) => {
  logger.info(`[${PLATFORM}] Mentions requested - API integration pending`);
  return [];
};

module.exports = { getFacebookStats, getFacebookMentions };
