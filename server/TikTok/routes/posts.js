const express = require("express");
const router = express.Router();
const axios = require("axios");
const { fetchAndSavePosts, getPostsForAccount } = require("../controllers/postController");

const isAllowedTikTokMediaUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("tiktokcdn") ||
    lower.includes("tiktokv.com") ||
    lower.includes("tiktok.com") ||
    lower.includes("ttcdn") ||
    lower.includes("akamaized.net")
  );
};

const proxyMedia = async (req, res, defaultContentType) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ message: "URL parameter is required" });
  }

  if (!isAllowedTikTokMediaUrl(url)) {
    return res.status(403).json({ message: "Only TikTok/CDN URLs are allowed" });
  }

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxRedirects: 5,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.tiktok.com/",
    },
  });

  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET");
  res.set("Content-Type", response.headers["content-type"] || defaultContentType);
  res.set("Cache-Control", "public, max-age=86400");
  res.send(response.data);
};

router.get("/proxy/image", async (req, res) => {
  try {
    await proxyMedia(req, res, "image/jpeg");
  } catch (error) {
    console.error("Image proxy error:", error.message);
    res.status(500).json({ message: "Failed to fetch image", error: error.message });
  }
});

router.get("/proxy/video", async (req, res) => {
  try {
    await proxyMedia(req, res, "video/mp4");
  } catch (error) {
    console.error("Video proxy error:", error.message);
    res.status(500).json({ message: "Failed to fetch video", error: error.message });
  }
});

router.post("/:accountId/fetch", fetchAndSavePosts);
router.get("/:accountId", getPostsForAccount);

module.exports = router;
