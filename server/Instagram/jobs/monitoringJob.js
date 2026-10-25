const cron = require('node-cron');
const MonitoredAccount = require('../models/MonitoredAccount');
const { fetchAndSaveAccountPosts } = require('../services/instagramService');
const logger = require('../config/logger');

let isRunning = false;
let cronJob = null;

const fetchLatestPosts = async () => {
  if (isRunning) {
    logger.warn('Instagram monitoring cycle already running; skipping this iteration');
    return;
  }

  isRunning = true;
  const startedAt = Date.now();
  try {
    const accounts = await MonitoredAccount.find({
      platform: 'instagram',
      monitoringStatus: { $in: ['active', 'error'] },
    }).sort({ _id: 1 });

    logger.info(`Instagram cycle started for ${accounts.length} account(s)`);
    for (const account of accounts) {
      try {
        const result = await fetchAndSaveAccountPosts(account, 10);
        logger.info(`Instagram @${account.username}: ${result.saved.length} new alert(s)`);
      } catch (error) {
        logger.error(`Instagram @${account.username} failed: ${error.message}`);
        await MonitoredAccount.findByIdAndUpdate(account._id, {
          lastChecked: new Date(),
          monitoringStatus: 'error',
        }).catch((updateError) => logger.error(
          `Could not mark Instagram @${account.username} as error: ${updateError.message}`,
        ));
      }
    }
  } catch (error) {
    logger.error(`Instagram monitoring cycle failed: ${error.message}`);
  } finally {
    logger.info(`Instagram cycle completed in ${Date.now() - startedAt}ms`);
    isRunning = false;
  }
};

const startMonitoring = () => {
  if (cronJob) {
    logger.warn('Instagram monitoring is already running');
    return;
  }
  fetchLatestPosts().catch((error) => logger.error(`Initial Instagram cycle failed: ${error.message}`));
  cronJob = cron.schedule(process.env.INSTAGRAM_MONITORING_CRON || '*/15 * * * *', fetchLatestPosts, {
    scheduled: true,
    timezone: 'UTC',
  });
  logger.info('Instagram monitoring scheduler started');
};

const stopMonitoring = () => {
  if (!cronJob) return;
  cronJob.stop();
  cronJob = null;
};

module.exports = { startMonitoring, stopMonitoring, fetchLatestPosts };
