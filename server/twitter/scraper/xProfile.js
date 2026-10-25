const { createPage } = require('./browser');
const { parseMetricValue } = require('./parser');
const logger = require('../config/logger');

const profileUrl = (username) => `https://x.com/${encodeURIComponent(username.replace(/^@/, ''))}`;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
      if (status === 403) {
        throw new Error('Public X rejected this request with HTTP 403');
      }

      if (status >= 500) {
        throw new Error(`Public X returned HTTP ${status}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      const isTransient = /HTTP 522|HTTP 5\d\d|Timeout|timed out|net::ERR_/i.test(error.message);
      if (!isTransient || attempt === 3) break;

      const delay = attempt * 3000;
      logger.warn(`X navigation for @${username} failed (${error.message}); retrying in ${delay}ms`);
      await wait(delay);
    }
  }

  throw lastError;
};

const scrapeProfile = async (username) => {
  const { context, page } = await createPage();
  try {
    await openProfile(page, username);
    await page.waitForSelector('main', { state: 'visible' });

    const data = await page.locator('main').evaluate((main) => {
      const text = main.innerText || '';
      const image = main.querySelector('img[src*="profile_images"]')?.src || '';
      const description = main.querySelector('[data-testid="UserDescription"]')?.innerText || '';
      const name = main.querySelector('[data-testid="UserName"]')?.innerText || '';
      return { text, image, description, name };
    });

    const lines = data.name.split('\n').map((line) => line.trim()).filter(Boolean);
    const numbers = [...data.text.matchAll(/([\d,.]+[KMB]?)\s+(Followers|Following|Posts)/gi)];
    const metric = (label) => {
      const match = numbers.find((item) => item[2].toLowerCase() === label.toLowerCase());
      return parseMetricValue(match?.[1]);
    };

    return {
      username: username.replace(/^@/, '').toLowerCase(),
      displayName: lines[0] || username,
      profileImage: data.image,
      bio: data.description,
      followers: metric('Followers'),
      following: metric('Following'),
      tweetsCount: metric('Posts'),
    };
  } catch (error) {
    logger.warn(`Could not scrape public X profile @${username}: ${error.message}`);
    throw error;
  } finally {
    await context.close();
  }
};

const scrapeRecentPosts = async (username, maxResults = 10) => {
  const { context, page } = await createPage();
  try {
    await openProfile(page, username);
    await page.waitForSelector('article', { state: 'visible' });

    const posts = await page.locator('article').evaluateAll((articles, limit) => articles.slice(0, limit).map((article) => {
      const statusLink = [...article.querySelectorAll('a[href*="/status/"]')]
        .find((link) => /\/status\/[^/]+/.test(link.getAttribute('href') || ''));
      const href = statusLink?.getAttribute('href') || '';
      const postId = href.match(/\/status\/(\d+)/)?.[1];
      const readText = (element) => [
        element.getAttribute('content'),
        element.innerText,
        element.textContent,
        element.getAttribute('aria-label'),
      ]
        .map((value) => (value || '').replace(/\s+/g, ' ').trim())
        .find(Boolean) || '';

      const text = [
        '[data-testid="tweetText"]',
        'meta[itemprop="text"]',
        'div[lang]',
        '[dir="auto"]',
        '[lang]',
      ]
        .flatMap((selector) => [...article.querySelectorAll(selector)].map(readText))
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort((first, second) => second.length - first.length)[0] || '';
      const time = article.querySelector('time')?.getAttribute('datetime');
      const media = [...article.querySelectorAll('img, video')]
        .map((element) => {
          const isVideo = element.tagName.toLowerCase() === 'video';
          const source = element.querySelector('source')?.getAttribute('src') || '';
          const url = element.getAttribute('src') || source;
          const previewUrl = element.getAttribute('poster') || (!isVideo ? url : '');

          return {
            type: isVideo ? 'video' : 'photo',
            url,
            previewUrl,
            width: Number(element.getAttribute('width')) || 0,
            height: Number(element.getAttribute('height')) || 0,
          };
        })
        .filter((item) => (
          (item.url || item.previewUrl) &&
          !(item.url || item.previewUrl).includes('profile_images')
        ));
      const labels = [...article.querySelectorAll('[aria-label]')].map((element) => element.getAttribute('aria-label')).join(' ');

      return {
        postId,
        text,
        url: postId ? `https://x.com/${href.split('/')[1]}/status/${postId}` : '',
        postedAt: time,
        media,
        metrics: {
          likes: 0,
          retweets: 0,
          replies: 0,
          quotes: 0,
          raw: labels,
        },
      };
    }).filter((post) => post.postId), maxResults);

    const uniquePosts = posts.filter((post, index, allPosts) => (
      allPosts.findIndex((candidate) => candidate.postId === post.postId) === index
    ));

    return uniquePosts.map((post) => ({
      ...post,
      username: username.replace(/^@/, '').toLowerCase(),
      activityType: post.media.some((item) => item.type === 'video') ? 'video' : post.media.length ? 'image' : 'tweet',
    }));
  } catch (error) {
    logger.warn(`Could not scrape public X posts for @${username}: ${error.message}`);
    throw error;
  } finally {
    await context.close();
  }
};

module.exports = { scrapeProfile, scrapeRecentPosts };
