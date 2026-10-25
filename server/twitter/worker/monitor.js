/**
 * Unified Monitoring Cycle - Worker
 * 
 * This module executes the UNIFIED monitoring cycle.
 * All monitored Twitter accounts are processed together in a single cycle.
 * 
 * Flow per cycle:
 * 1. Discover all active accounts (dynamic - includes newly added)
 * 2. Process each account (fetch latest tweets, create alerts)
 * 3. Update account state (lastTweetId, lastChecked)
 * 4. Handle errors gracefully
 */

const MonitoredAccount = require('../models/MonitoredAccount');
const Alert = require('../models/Alert');
const twitterService = require('../services/twitterService');
const alertService = require('../services/alertService');
const logger = require('../config/logger');

// Prevent concurrent cycle execution
let isRunning = false;
let cycleStartTime = null;

/**
 * Check/process a single account
 * Called for EACH account in the unified cycle
 */
const checkAccount = async (account) => {
  const accountStartTime = Date.now();
  try {
    const isInitialCheck = !account.lastTweetId;
    const hasBlankAlert = await Alert.exists({
      accountId: account._id,
      $or: [{ content: '' }, { content: { $exists: false } }],
    });
    const fetchLimit = isInitialCheck ? 1 : 10;
    const sinceId = hasBlankAlert ? null : account.lastTweetId;
    
    logger.info(
      `[UnifiedCycle] Processing @${account.username} ` +
      `${isInitialCheck ? '(initial check)' : '(update)'}`
    );

    const posts = await twitterService.getLatestTweets(
      account.username,
      sinceId,
      fetchLimit,
    );
    let newestPostId = account.lastTweetId;

    // Deduplicate posts
    const uniquePosts = posts.filter((post, index, allPosts) => (
      post.tweetId && allPosts.findIndex((candidate) => candidate.tweetId === post.tweetId) === index
    ));

    // Process posts in chronological order
    for (const post of uniquePosts.sort((a, b) => new Date(a.tweetCreatedAt) - new Date(b.tweetCreatedAt))) {
      try {
        // Avoid duplicate alerts
        const existingAlert = await Alert.findOne({
          platform: 'twitter',
          externalId: post.tweetId,
        }).select('_id content').lean();
        if (existingAlert) {
          if (!existingAlert.content?.trim() && post.content?.trim()) {
            await Alert.updateOne(
              { _id: existingAlert._id },
              { $set: { content: post.content.trim() } },
            );
          }
          newestPostId = post.tweetId;
          continue;
        }

        // Create alert for new post
        await alertService.createAlert({
          accountId: account._id,
          platform: 'twitter',
          externalId: post.tweetId,
          username: account.username,
          displayName: account.displayName,
          profileImage: account.profileImage,
          tweetId: post.tweetId,
          content: post.content,
          media: post.media,
          sourceUrl: post.tweetUrl,
          tweetUrl: post.tweetUrl,
          activityType: post.activityType,
          retweetedFrom: post.retweetedFrom,
          replyTo: post.replyTo,
          quotedTweet: post.quotedTweet,
          metrics: post.metrics,
          sourceCreatedAt: post.tweetCreatedAt,
          tweetCreatedAt: post.tweetCreatedAt,
        });
        newestPostId = post.tweetId;
      } catch (alertError) {
        logger.warn(
          `[UnifiedCycle] Failed to create alert for @${account.username} tweet ${post.tweetId}: ${alertError.message}`
        );
      }
    }

    // Update account state
    await MonitoredAccount.findByIdAndUpdate(account._id, {
      lastChecked: new Date(),
      lastTweetId: newestPostId,
      monitoringStatus: 'active',
    });

    const duration = Date.now() - accountStartTime;
    logger.info(
      `[UnifiedCycle] ✓ @${account.username}: ${uniquePosts.length} new post(s) ` +
      `${isInitialCheck ? '(initial)' : ''} (${duration}ms)`
    );
  } catch (error) {
    const duration = Date.now() - accountStartTime;
    logger.warn(
      `[UnifiedCycle] ✗ @${account.username}: ${error.message} (${duration}ms)`
    );
    
    try {
      await MonitoredAccount.findByIdAndUpdate(account._id, {
        lastChecked: new Date(),
        monitoringStatus: 'active',
      });
    } catch (updateError) {
      logger.error(`[UnifiedCycle] Failed to update account ${account.username}:`, updateError);
    }
  }
};

/**
 * Execute the UNIFIED monitoring cycle
 * 
 * This is the core method that:
 * 1. Fetches ALL currently monitored accounts
 * 2. Processes ALL of them in this single cycle
 * 3. Prevents concurrent execution
 * 4. Newly added accounts are automatically included
 */
const runMonitoringCycle = async () => {
  // Prevent concurrent cycles
  if (isRunning) {
    logger.warn('[UnifiedCycle] Cycle already running, skipping this iteration');
    return;
  }

  isRunning = true;
  cycleStartTime = Date.now();
  let accountsProcessed = 0;
  let accountsWithErrors = 0;

  try {
    logger.info(
      `\n${'─'.repeat(70)}\n` +
      `[UnifiedCycle] CYCLE STARTED - Discovering accounts...\n` +
      `${'─'.repeat(70)}`
    );

    // DYNAMIC DISCOVERY: Fetch all monitored accounts (includes newly added)
    const accounts = await MonitoredAccount.find({
      monitoringStatus: { $in: ['active', 'error'] },
    });

    if (!accounts || accounts.length === 0) {
      logger.info('[UnifiedCycle] No accounts to monitor in this cycle');
      return;
    }

    logger.info(
      `[UnifiedCycle] Discovered ${accounts.length} account(s) for processing in THIS cycle`
    );
    logger.info(
      `[UnifiedCycle] Account list: ${accounts.map(a => `@${a.username}`).join(', ')}`
    );
    logger.info('[UnifiedCycle] Processing all accounts together...');

    // Process all accounts in this unified cycle
    for (const account of accounts) {
      try {
        await checkAccount(account);
        accountsProcessed++;
      } catch (error) {
        accountsWithErrors++;
        logger.error(
          `[UnifiedCycle] Error processing @${account.username}:`,
          error
        );
      }
    }
  } catch (error) {
    logger.error('[UnifiedCycle] Critical error in monitoring cycle:', error);
  } finally {
    const cycleDuration = Date.now() - cycleStartTime;
    logger.info(
      `\n${'─'.repeat(70)}\n` +
      `[UnifiedCycle] CYCLE COMPLETED\n` +
      `[UnifiedCycle] - Processed: ${accountsProcessed} account(s)\n` +
      `[UnifiedCycle] - Errors: ${accountsWithErrors}\n` +
      `[UnifiedCycle] - Duration: ${cycleDuration}ms\n` +
      `[UnifiedCycle] - Next cycle will auto-include any newly added accounts\n` +
      `${'─'.repeat(70)}\n`
    );
    isRunning = false;
  }
};

module.exports = { checkAccount, runMonitoringCycle };
