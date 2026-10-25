const { createPage, hasStoredSession } = require('./browser');
const logger = require('../config/logger');

const cleanUsername = (value) => String(value || '')
  .replace(/^@/, '')
  .trim()
  .toLowerCase();

const profileUrl = (username) => `https://www.instagram.com/${encodeURIComponent(cleanUsername(username))}/`;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const transientError = (message) => /5\d\d|Timeout|timed out|net::ERR_|Target page|closed/i.test(message);

const fetchPostCaption = async (context, url, postId) => {
  if (!url || !postId) return '';
  const detailPage = await context.newPage();
  try {
    await detailPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await detailPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
    return await detailPage.evaluate((expectedPostId) => {
      const findMatchingCaption = (value) => {
        if (!value || typeof value !== 'object') return '';
        const matchesPost = [value.code, value.shortcode, value.shortCode, value.id]
          .some((candidate) => String(candidate || '') === expectedPostId);
        if (matchesPost) {
          if (typeof value.caption === 'string') return value.caption.trim();
          if (value.caption && typeof value.caption.text === 'string') return value.caption.text.trim();
          if (value.edge_media_to_caption?.edges?.[0]?.node?.text) {
            return value.edge_media_to_caption.edges[0].node.text.trim();
          }
        }
        for (const child of Object.values(value)) {
          const caption = findMatchingCaption(child);
          if (caption) return caption;
        }
        return '';
      };

      for (const script of document.scripts) {
        try {
          const caption = findMatchingCaption(JSON.parse(script.textContent || ''));
          if (caption) return caption;
        } catch {
          // Ignore scripts that do not contain JSON.
        }
      }

      return document.querySelector('article h1, article h2')?.textContent?.trim() || '';
    }, postId);
  } catch (error) {
    logger.warn(`Instagram caption fetch failed for ${url}: ${error.message}`);
    return '';
  } finally {
    await detailPage.close();
  }
};

const openProfile = async (page, username) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await page.goto(profileUrl(username), {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      const status = response?.status() || 0;
      if (status === 401 || status === 403 || /\/accounts\/login/i.test(page.url())) {
        throw new Error(hasStoredSession()
          ? 'Instagram Playwright session is expired or blocked.'
          : 'Instagram requires an authenticated Playwright session. Create .instagram-auth.json with PLAYWRIGHT_HEADLESS=false before scraping.');
      }
      if (status >= 500) throw new Error(`Instagram returned HTTP ${status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (!transientError(error.message) || attempt === 3) break;
      const delay = attempt * 2000;
      logger.warn(`Instagram navigation for @${username} failed (${error.message}); retrying in ${delay}ms`);
      await wait(delay);
    }
  }
  throw lastError;
};

const scrapeProfile = async (username) => {
  const normalized = cleanUsername(username);
  if (!normalized) throw new Error('Missing Instagram username');
  const { context, page } = await createPage();
  try {
    await openProfile(page, normalized);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
    const data = await page.evaluate(() => ({
      displayName: document.querySelector('header h1')?.textContent?.trim() ||
        document.querySelector('meta[property="og:title"]')?.content?.split('(')[0]?.trim() || '',
      profileImage: document.querySelector('header img')?.src ||
        document.querySelector('meta[property="og:image"]')?.content || '',
      bio: document.querySelector('header')?.innerText ||
        document.querySelector('meta[name="description"]')?.content || '',
      hasProfileHeader: Boolean(document.querySelector('header')),
      hasPostLink: Boolean(document.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]')),
    }));
    if (!data.hasProfileHeader && !data.hasPostLink && !data.profileImage && !data.bio) {
      throw new Error(`Instagram profile @${normalized} was not found or returned an empty page.`);
    }
    return {
      username: normalized,
      displayName: data.displayName || normalized,
      profileImage: data.profileImage || '',
      bio: data.bio || '',
    };
  } finally {
    await context.close();
  }
};

const scrapeRecentPosts = async (username, maxResults = 10) => {
  const normalized = cleanUsername(username);
  if (!normalized) throw new Error('Missing Instagram username');
  const limit = Math.max(1, Math.min(Number(maxResults) || 10, 50));
  const { context, page } = await createPage();
  try {
    await openProfile(page, normalized);
    await page.waitForSelector('article, main a[href*="/p/"], main a[href*="/reel/"]', { state: 'visible' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

    const posts = new Map();
    for (let pass = 0; pass < 5 && posts.size < limit; pass += 1) {
      const batch = await page.evaluate(() => {
        const candidates = [...document.querySelectorAll('article, main a[href*="/p/"], main a[href*="/reel/"], main a[href*="/tv/"]')];
        return candidates.map((node) => {
          const article = node.matches('article') ? node : node.closest('article') || node.parentElement;
          const link = article?.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]') || (node.matches('a') ? node : null);
          const href = link?.href || '';
          const id = href.match(/\/(?:p|reel|tv)\/([^/?#]+)/i)?.[1] || '';
          if (!id) return null;
          const video = article?.querySelector('video');
          const images = [...(article?.querySelectorAll('img') || [])]
            .map((image) => image.src || image.getAttribute('data-src') || '')
            .filter(Boolean);
          const timestamp = article?.querySelector('time')?.dateTime || '';
          return {
            postId: id,
            shortCode: id,
            url: href,
            caption: '',
            timestamp,
            type: video ? 'Video' : images.length > 1 ? 'Carousel' : 'Image',
            displayUrl: images[0] || video?.poster || '',
            videoUrl: video?.src || video?.querySelector('source')?.src || '',
            images,
          };
        }).filter(Boolean);
      });
      batch.forEach((post) => posts.set(post.postId, post));
      if (posts.size >= limit) break;
      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(1200);
    }
    const postsWithCaptions = [];
    for (const post of [...posts.values()].slice(0, limit)) {
      postsWithCaptions.push({
        ...post,
        caption: await fetchPostCaption(context, post.url, post.postId),
      });
    }
    return postsWithCaptions.map((post) => ({
      ...post,
      username: normalized,
      ownerUsername: normalized,
      ownerFullName: normalized,
      activityType: post.type === 'Video' ? 'video' : 'image',
    }));
  } finally {
    await context.close();
  }
};

module.exports = { scrapeProfile, scrapeRecentPosts, profileUrl, cleanUsername };
