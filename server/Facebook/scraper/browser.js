const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const logger = require('../config/logger');

let browserPromise = null;
const storageStatePath = path.join(__dirname, '../.facebook-auth.json');

const launchBrowser = async () => {
  if (!browserPromise) {
    const headless = process.env.PLAYWRIGHT_HEADLESS === 'true';
    const launchOptions = { headless };

    if (!headless) {
      launchOptions.args = [
        '--start-minimized',
        '--window-position=-32000,-32000',
        '--window-size=1280,900',
      ];
    }

    browserPromise = chromium.launch(launchOptions).catch((error) => {
      browserPromise = null;
      logger.error(`Failed to launch Playwright: ${error.message}`);
      throw error;
    });
  }

  return browserPromise;
};

const readStorageState = () => {
  if (!fs.existsSync(storageStatePath)) return null;

  try {
    const raw = fs.readFileSync(storageStatePath, 'utf8');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    logger.warn(`Could not read Facebook storage state: ${error.message}`);
    return null;
  }
};

const createContext = async ({ useStoredSession = true } = {}) => {
  const browser = await launchBrowser();
  const storageState = useStoredSession ? readStorageState() : null;

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...(storageState ? { storageState } : {}),
  });

  return { browser, context };
};

const createPage = async ({ useStoredSession = true } = {}) => {
  const { context } = await createContext({ useStoredSession });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  return { context, page };
};

const ensureFacebookSession = async () => {
  const email = process.env.FACEBOOK_EMAIL;
  const password = process.env.FACEBOOK_PASSWORD;

  if (!email || !password) {
    throw new Error('FACEBOOK_EMAIL and FACEBOOK_PASSWORD must be set in the Facebook .env file before authenticated scraping can work.');
  }

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto('https://www.facebook.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="pass"]');

    if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
      await emailInput.fill(email);
      await passwordInput.fill(password);
      const loginButton = page.locator('button[name="login"], input[name="login"], button[type="submit"]');
      if (await loginButton.count() > 0) {
        await loginButton.first().click();
      } else {
        await passwordInput.press('Enter');
      }
      logger.info('Facebook credentials submitted; waiting for login to complete.');
    }

    await page.waitForFunction(() => {
      const url = new URL(window.location.href);
      return !url.pathname.includes('/login') && !url.pathname.includes('/login.php');
    }, { timeout: 600000 }).catch(() => undefined);

    if (page.url().includes('/login')) {
      throw new Error('Facebook login did not complete. Complete the security or login challenge in the browser, then retry.');
    }

    await context.storageState({ path: storageStatePath });
    logger.info('Facebook Playwright session saved to disk.');

    return { browser, context, page };
  } catch (error) {
    logger.error(`Facebook login failed: ${error.message}`);
    await context.close().catch(() => undefined);
    if (browserPromise) {
      browserPromise = null;
      await browser.close().catch(() => undefined);
    }
    throw error;
  }
};

const closeBrowser = async () => {
  if (browserPromise) {
    const browser = await browserPromise;
    browserPromise = null;
    await browser.close();
  }
};

module.exports = { createPage, createContext, ensureFacebookSession, closeBrowser };
