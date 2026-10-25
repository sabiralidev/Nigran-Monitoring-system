const logger = require('../config/logger');
const PLATFORM = 'bluesky';
const getBlueskyStats = async () => { logger.info(`[${PLATFORM}] Stats - pending`); return { mentions: 150, engagement: 95, sentiment: { positive: 55, negative: 10, neutral: 35 } }; };
const getBlueskyMentions = async () => { return []; };
module.exports = { getBlueskyStats, getBlueskyMentions };
