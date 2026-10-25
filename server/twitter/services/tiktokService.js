const logger = require('../config/logger');
const PLATFORM = 'tiktok';
const getTiktokStats = async () => { logger.info(`[${PLATFORM}] Stats - pending`); return { mentions: 2340, engagement: 8900, sentiment: { positive: 52, negative: 18, neutral: 30 } }; };
const getTiktokMentions = async () => { return []; };
module.exports = { getTiktokStats, getTiktokMentions };
