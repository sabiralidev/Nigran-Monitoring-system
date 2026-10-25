const { chromium } = require('playwright');
const logger = require('../config/logger');

let browserPromise = null;

const getXAuthCookies = () => {
  const authToken = process.env.X_AUTH_TOKEN?.trim();
  const csrfToken = process.env.X_CT0?.trim();

  if (!authToken || !csrfToken) {
    return [];
  }

  return [
    { name: 'auth_token', value: authToken, domain: '.x.com', path: '/', httpOnly: true, secure: true },
    { name: 'ct0', value: csrfToken, domain: '.x.com', path: '/', secure: true },
  ];
};

const launchBrowser = async () => {
  if (!browserPromise) {
    const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
    const explicitlyHeadless = process.env.PLAYWRIGHT_HEADLESS === 'true';
    const headless = explicitlyHeadless || !hasDisplay;
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

const createPage = async () => {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const authCookies = getXAuthCookies();
  if (authCookies.length > 0) {
    await context.addCookies(authCookies);
  }
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  return { context, page };
};

const closeBrowser = async () => {
  if (browserPromise) {
    const browser = await browserPromise;
    browserPromise = null;
    await browser.close();
  }
};

module.exports = { createPage, closeBrowser };
