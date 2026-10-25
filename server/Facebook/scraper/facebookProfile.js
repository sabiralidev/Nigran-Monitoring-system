const fs = require('fs');
const path = require('path');
const { createPage, ensureFacebookSession, closeBrowser } = require('./browser');
const logger = require('../config/logger');

const profileUrl = (username) => `https://www.facebook.com/${encodeURIComponent(username.replace(/^@/, '').trim())}`;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const storageStatePath = path.join(__dirname, '../.facebook-auth.json');

const hasStoredSession = () => fs.existsSync(storageStatePath);

const openProfile = async (page, username) => {
  const url = profileUrl(username);
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      const status = response?.status() || 0;
      if (status === 403 || status === 401 || page.url().includes('/login/?next=')) {
        throw new Error('Facebook requires an authenticated Playwright session.');
      }

      if (status >= 500) {
        throw new Error(`Facebook returned HTTP ${status}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      const isTransient = /HTTP 522|HTTP 5\d\d|Timeout|timed out|net::ERR_|Target page, context or browser has been closed/i.test(error.message);

      if (!/authenticated Playwright session/i.test(error.message) && (!isTransient || attempt === 3)) {
        break;
      }

      if (/authenticated Playwright session/i.test(error.message)) {
        if (!hasStoredSession()) {
          logger.warn('Facebook session missing; creating a fresh authenticated login session.');
          const loginSession = await ensureFacebookSession();
          await loginSession.context.close();
          await closeBrowser();
          throw new Error('Facebook login session initialized. Please retry the scrape.');
        }

        const freshSession = await createPage({ useStoredSession: true });
        const loginPage = freshSession.page;
        const response = await loginPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const status = response?.status() || 0;
        if (status === 403 || status === 401 || loginPage.url().includes('/login/?next=')) {
          await freshSession.context.close();
          fs.unlinkSync(storageStatePath);
          logger.warn('Stored Facebook session is invalid or expired; starting a fresh login session.');
          const loginSession = await ensureFacebookSession();
          await loginSession.context.close();
          await closeBrowser();
          throw new Error('Facebook login session initialized. Please retry the scrape.');
        }

        await freshSession.context.close();
        return response;
      }

      if (isTransient && attempt < 3) {
        const delay = attempt * 3000;
        logger.warn(`Facebook navigation for ${username} failed (${error.message}); retrying in ${delay}ms`);
        await wait(delay);
      }
    }
  }

  throw lastError;
};

const sanitizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();

const scrapeProfile = async (username) => {
  const cleanUsername = String(username || '').replace(/^@/, '').trim();
  if (!cleanUsername) {
    throw new Error('Missing Facebook username');
  }

  const { context, page } = await createPage({ useStoredSession: hasStoredSession() });

  try {
    await openProfile(page, cleanUsername);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

    const data = await page.evaluate(() => {
      const sanitizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();

      const profileName =
        document.querySelector('h1')?.innerText ||
        document.querySelector('[data-testid="profile_name"]')?.innerText ||
        document.querySelector('meta[property="og:title"]')?.content ||
        '';

      const profileImage =
        document.querySelector('img[alt*="profile photo" i]')?.src ||
        document.querySelector('img[alt*="Profile picture" i]')?.src ||
        document.querySelector('meta[property="og:image"]')?.content ||
        '';

      const bio =
        document.querySelector('[data-testid="profile_about_card"]')?.innerText ||
        document.querySelector('meta[name="description"]')?.content ||
        '';

      return {
        displayName: sanitizeText(profileName),
        profileImage: sanitizeText(profileImage),
        bio: sanitizeText(bio),
      };
    });

    return {
      username: cleanUsername.toLowerCase(),
      displayName: data.displayName || cleanUsername,
      profileImage: data.profileImage,
      bio: data.bio,
    };
  } catch (error) {
    logger.warn(`Could not scrape Facebook profile ${cleanUsername}: ${error.message}`);
    throw error;
  } finally {
    await context.close();
  }
};

const scrapeRecentPosts = async (username, maxResults = 10) => {
  const cleanUsername = String(username || '').replace(/^@/, '').trim();
  if (!cleanUsername) {
    throw new Error('Missing Facebook username');
  }

  const { context, page } = await createPage({ useStoredSession: hasStoredSession() });

  try {
    await openProfile(page, cleanUsername);
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);

    const rawPosts = await page.evaluate((limit) => {
      const sanitizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();
      const feedNodes = [...document.querySelectorAll('article, div[data-pagelet^="FeedUnit_"], div[role="article"]')].slice(0, 50);

      return feedNodes.map((article) => {
        const anchor = [...article.querySelectorAll('a[href]')].find((link) => {
          const href = link.getAttribute('href') || '';
          return /\/posts\//i.test(href) ||
            /\/reel(?:s)?\//i.test(href) ||
            /\/videos?\//i.test(href) ||
            /\/watch(?:\.php)?\/?\?/i.test(href) ||
            /\/photo\.php\?/i.test(href) ||
            /(?:story_fbid|permalink\.php\?|fbid=)/i.test(href) ||
            /\/story\.php\?/i.test(href);
        });

        const href = anchor?.getAttribute('href') || '';
        let url = '';
        try {
          url = href ? new URL(href, 'https://www.facebook.com').href : '';
        } catch {
          url = href;
        }

        const postId = (
          href.match(/story_fbid=([^&]+)/i)?.[1] ||
          href.match(/(?:\/posts\/|\/reels?\/|\/videos?\/)([^/?#]+)/i)?.[1] ||
          href.match(/\/story\.php\?story_fbid=([^&]+)/i)?.[1] ||
          href.match(/[?&](?:fbid|v)=([^&#]+)/i)?.[1] ||
          ''
        ).trim();

        const textCandidate = [
          'div[dir="auto"]',
          '[data-testid="post_message"]',
          '[data-ad-preview="message"]',
          'span',
        ].map((selector) => [...article.querySelectorAll(selector)])
          .flat()
          .map((element) => sanitizeText(element.innerText || element.textContent || ''))
          .find((value) => value && value.length > 0) || '';

        const media = [...article.querySelectorAll('img, video, source')]
          .map((element) => {
            const tagName = element.tagName.toLowerCase();
            const src = element.getAttribute('src') || element.getAttribute('poster') || '';
            if (!src || (!src.includes('fbcdn') && !src.includes('scontent') && !src.includes('akamaihd'))) {
              return null;
            }
            return {
              type: tagName === 'video' ? 'video' : 'image',
              url: src,
              previewUrl: element.getAttribute('poster') || src,
            };
          })
          .filter(Boolean)
          .slice(0, 10);

        const isVideoPost = /\/reel(?:s)?\//i.test(url) ||
          /\/videos?\//i.test(url) ||
          /\/watch(?:\.php)?\/?\?/i.test(url) ||
          /[?&]v=[^&#]+/i.test(url) ||
          Boolean(article.querySelector('video, source'));

        if (isVideoPost && media.length > 0) {
          media[0] = { ...media[0], type: 'video' };
        }

        return {
          postId,
          text: textCandidate,
          url,
          postedAt: article.querySelector('abbr')?.getAttribute('title') || article.querySelector('time')?.getAttribute('datetime') || new Date().toISOString(),
          media,
          isVideoPost,
        };
      }).filter((post) => post.postId || post.text || post.url);
    }, maxResults);

    const uniquePosts = rawPosts.filter((post, index, allPosts) => {
      if (!post.postId) return index === allPosts.findIndex((candidate) => candidate.url === post.url || candidate.text === post.text);
      return allPosts.findIndex((candidate) => candidate.postId === post.postId) === index;
    });

    return uniquePosts.slice(0, maxResults).map((post) => ({
      postId: post.postId || `${cleanUsername}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      username: cleanUsername.toLowerCase(),
      text: post.text || '',
      url: post.url || `https://www.facebook.com/${cleanUsername}`,
      postedAt: post.postedAt || new Date().toISOString(),
      media: post.media || [],
      activityType: post.isVideoPost || post.media?.some((item) => item.type === 'video')
        ? 'video'
        : post.media?.length ? 'image' : 'post',
    }));
  } catch (error) {
    logger.warn(`Could not scrape Facebook posts for ${cleanUsername}: ${error.message}`);
    throw error;
  } finally {
    await context.close();
  }
};

module.exports = { scrapeProfile, scrapeRecentPosts };
