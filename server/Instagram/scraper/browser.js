const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const logger = require('../config/logger');

let browserPromise = null;
const storageStatePath = path.join(__dirname, '../.instagram-auth.json');

const launchBrowser = async ({ interactive = false } = {}) => {
  if (!browserPromise) {
    const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
    const options = { headless };
    if (!headless && !interactive) {
      options.args = [
        '--start-minimized',
        '--window-position=-32000,-32000',
        '--window-size=1280,900',
      ];
    }
    browserPromise = chromium.launch(options).catch((error) => {
      browserPromise = null;
      logger.error(`Failed to launch Instagram Playwright: ${error.message}`);
      throw error;
    });
  }
  return browserPromise;
};

const hasStoredSession = () => fs.existsSync(storageStatePath);

const createContext = async ({ useStoredSession = true } = {}) => {
  const browser = await launchBrowser();
  const storageState = useStoredSession && hasStoredSession()
    ? storageStatePath
    : undefined;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...(storageState ? { storageState } : {}),
  });
  return { browser, context };
};

const createPage = async (options = {}) => {
  const { context } = await createContext(options);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  return { context, page };
};

const closeBrowser = async () => {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
};

const ensureInstagramSession = async () => {
  if (process.env.PLAYWRIGHT_HEADLESS !== 'false') {
    throw new Error('Set PLAYWRIGHT_HEADLESS=false to create the Instagram session interactively.');
  }
  const browser = await launchBrowser({ interactive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    logger.warn('Complete Instagram login in the visible browser window. Waiting for the login page to close.');
    await page.waitForFunction(() => !window.location.pathname.includes('/accounts/login'), {
      timeout: 600000,
    });
    await context.storageState({ path: storageStatePath });
    logger.info('Instagram Playwright session saved.');
  } finally {
    await context.close();
  }
};

module.exports = {
  createPage,
  createContext,
  closeBrowser,
  ensureInstagramSession,
  hasStoredSession,
  storageStatePath,
};
