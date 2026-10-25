const logger = require('../config/logger');
const PLATFORM = 'zangi';
const getZangiStats = async () => { logger.info(`[${PLATFORM}] Stats - pending`); return { mentions: 80, engagement: 60, sentiment: { positive: 30, negative: 20, neutral: 50 } }; };
const getZangiMentions = async () => { return []; };
module.exports = { getZangiStats, getZangiMentions };
