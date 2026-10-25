const express = require("express");
const router = express.Router();
const axios = require("axios");
const {
  fetchAndSavePosts,
  getPostsForAccount,
} = require("../controllers/postController");

const isAllowedInstagramCdnUrl = (value) => {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'instagram.com' ||
      hostname.endsWith('.instagram.com') ||
      hostname === 'cdninstagram.com' ||
      hostname.endsWith('.cdninstagram.com') ||
      hostname === 'fbcdn.net' ||
      hostname.endsWith('.fbcdn.net');
  } catch {
    return false;
  }
};

const proxyInstagramMedia = async (req, res, defaultContentType) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ message: "URL parameter is required" });
  }

  if (!isAllowedInstagramCdnUrl(url)) {
    return res
      .status(403)
      .json({ message: "Only Instagram/CDN URLs are allowed" });
  }

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxContentLength: 25 * 1024 * 1024,
    maxBodyLength: 25 * 1024 * 1024,
    maxRedirects: 0,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.instagram.com/",
    },
  });

  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET");
  res.set(
    "Content-Type",
    response.headers["content-type"] || defaultContentType,
  );
  res.set("Cache-Control", "public, max-age=86400");
  res.send(response.data);
};

// Image proxy endpoint to bypass CORS issues
router.get("/proxy/image", async (req, res) => {
  try {
    await proxyInstagramMedia(req, res, "image/jpeg");
  } catch (error) {
    console.error("Image proxy error:", error.message);
    res
      .status(500)
      .json({ message: "Failed to fetch image", error: error.message });
  }
});

// Video proxy endpoint for Instagram MP4 playback and downloads
router.get("/proxy/video", async (req, res) => {
  try {
    await proxyInstagramMedia(req, res, "video/mp4");
  } catch (error) {
    console.error("Video proxy error:", error.message);
    res
      .status(500)
      .json({ message: "Failed to fetch video", error: error.message });
  }
});

// Fetch and save posts for a specific account
router.post("/:accountId/fetch", fetchAndSavePosts);

// Get all posts for a specific account
router.get("/:accountId", getPostsForAccount);

module.exports = router;
