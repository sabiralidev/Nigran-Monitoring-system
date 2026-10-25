/**
 * Unified Twitter Monitoring Job
 * 
 * UNIFIED SCRAPING CYCLE:
 * - ONE centralized job handles ALL monitored Twitter accounts
 * - Newly added accounts are automatically included in the next cycle
 * - All accounts are processed together in a single cycle, not individually
 * - No separate jobs are created per account
 * 
 * Architecture:
 * - Single cron/interval scheduler (never multiple)
 * - Dynamic account discovery each cycle
 * - Sequential processing of all accounts within one cycle
 * - Centralized error handling and status tracking
 */

const cron = require('node-cron');
const logger = require('../config/logger');
const { closeBrowser } = require('../scraper/browser');
const { runMonitoringCycle } = require('../worker/monitor');

// Unified cycle state
let cronJob = null;
let monitoringInterval = null;
let isMonitoringStarted = false;
let cycleCount = 0;

/**
 * Start the UNIFIED monitoring cycle
 * 
 * This starts a SINGLE scheduler that processes ALL monitored accounts
 * together in one centralized cycle. Each cycle:
 * 1. Discovers all currently monitored accounts
 * 2. Processes all accounts in parallel/sequence
 * 3. Creates alerts for new/matching content
 * 4. Updates account state
 * 
 * Newly added accounts are automatically included in the next cycle.
 */
const startMonitoring = () => {
  if (isMonitoringStarted) {
    logger.warn('[UnifiedCycle] Monitoring is already running - only ONE unified cycle is active');
    return;
  }

  isMonitoringStarted = true;
  const intervalValue = parseInt(process.env.MONITORING_INTERVAL, 10) || 15;

  logger.info(
    `\n${'='.repeat(70)}\n` +
    `[UnifiedCycle] STARTING UNIFIED TWITTER MONITORING SYSTEM\n` +
    `[UnifiedCycle] - ONE centralized cycle for ALL accounts\n` +
    `[UnifiedCycle] - New accounts auto-included in next cycle\n` +
    `[UnifiedCycle] - NO separate jobs per account\n` +
    `[UnifiedCycle] - Schedule: Every ${intervalValue} ${intervalValue < 60 ? 'second(s)' : 'minute(s)'}\n` +
    `${'='.repeat(70)}\n`
  );

  if (intervalValue < 60) {
    monitoringInterval = setInterval(() => {
      cycleCount++;
      logger.info(`[UnifiedCycle] Starting cycle #${cycleCount}...`);
      runMonitoringCycle();
    }, intervalValue * 1000);
    logger.info(`[UnifiedCycle] ✓ Unified scheduler started with polling interval: ${intervalValue}s`);
  } else {
    cronJob = cron.schedule(`*/${intervalValue} * * * *`, () => {
      cycleCount++;
      logger.info(`[UnifiedCycle] Starting cycle #${cycleCount}...`);
      runMonitoringCycle();
    }, {
      scheduled: true,
      timezone: 'UTC',
    });
    logger.info(`[UnifiedCycle] ✓ Unified scheduler started with cron pattern: */${intervalValue} * * * *`);
  }

  // Run first cycle after short delay
  setTimeout(() => {
    cycleCount++;
    logger.info(`[UnifiedCycle] Running initial cycle #${cycleCount}...`);
    runMonitoringCycle();
  }, 5000);
};

/**
 * Stop the unified monitoring cycle
 */
const stopMonitoring = async () => {
  if (!isMonitoringStarted) {
    logger.warn('[UnifiedCycle] Monitoring is not running');
    return;
  }

  try {
    if (cronJob) {
      cronJob.stop();
      cronJob = null;
    }
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
    isMonitoringStarted = false;
    await closeBrowser();
    logger.info('[UnifiedCycle] ✓ Unified monitoring stopped successfully');
  } catch (error) {
    logger.error('[UnifiedCycle] Error stopping monitoring:', error);
  }
};

/**
 * Get unified cycle status
 */
const getUnifiedCycleStatus = () => {
  return {
    isRunning: isMonitoringStarted,
    cyclesExecuted: cycleCount,
    scheduler: cronJob ? 'cron' : (monitoringInterval ? 'interval' : 'none'),
  };
};

module.exports = { 
  startMonitoring, 
  stopMonitoring, 
  runMonitoringCycle,
  getUnifiedCycleStatus 
};
