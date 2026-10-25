const logger = require('../config/logger');

const PLATFORM = 'youtube';

const getYoutubeStats = async (options = {}) => {
  logger.info(`[${PLATFORM}] Stats requested - API integration pending`);
  return {
    mentions: 560,
    engagement: 4200,
    sentiment: { positive: 45, negative: 12, neutral: 43 },
  };
};

const getYoutubeVideos = async (options = {}) => {
  logger.info(`[${PLATFORM}] Videos requested - API integration pending`);
  return [];
};

module.exports = { getYoutubeStats, getYoutubeVideos };
