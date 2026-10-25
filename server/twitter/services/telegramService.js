const logger = require('../config/logger');
const PLATFORM = 'telegram';
const getTelegramStats = async () => { logger.info(`[${PLATFORM}] Stats - pending`); return { mentions: 430, engagement: 320, sentiment: { positive: 28, negative: 35, neutral: 37 } }; };
const getTelegramMentions = async () => { return []; };
module.exports = { getTelegramStats, getTelegramMentions };
