const logger = require('../config/logger');
const PLATFORM = 'instagram';
const getInstagramStats = async () => { logger.info(`[${PLATFORM}] Stats - pending`); return { mentions: 980, engagement: 2100, sentiment: { positive: 38, negative: 22, neutral: 40 } }; };
const getInstagramMentions = async () => { return []; };
module.exports = { getInstagramStats, getInstagramMentions };
