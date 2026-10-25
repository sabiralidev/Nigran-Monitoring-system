const express = require("express");
const router = express.Router();
const axios = require("axios");
const {
  fetchAndSavePosts,
  getPostsForAccount,
} = require("../controllers/postController");

// Image proxy endpoint to bypass CORS issues for Facebook images
router.get("/proxy/image", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ message: "URL parameter is required" });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ message: "Invalid image URL" });
    }

    const allowedHosts = [
      "facebook.com",
      "www.facebook.com",
      "fbcdn.net",
      "scontent.xx.fbcdn.net",
      "scontent-ord5-1.xx.fbcdn.net",
      "scontent-ord5-3.xx.fbcdn.net",
      "scontent-atl3-1.xx.fbcdn.net",
      "scontent-atl3-2.xx.fbcdn.net",
      "scontent-atl3-3.xx.fbcdn.net",
      "instagram.com",
      "www.instagram.com",
      "cdninstagram.com",
    ];

    const isAllowedHost = allowedHosts.some(
      (host) =>
        parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`),
    );

    if (!isAllowedHost) {
      return res
        .status(403)
        .json({ message: "Only Facebook/Instagram/CDN URLs are allowed" });
    }

    // Fetch the image from CDN
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    // Set proper CORS headers and cache headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Content-Type", response.headers["content-type"] || "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400"); // Cache for 24 hours

    res.send(response.data);
  } catch (error) {
    console.error("Image proxy error:", error.message);

    if (error.response?.status === 403 || error.response?.status === 429) {
      const { url } = req.query;
      if (url) {
        return res.redirect(307, url);
      }
    }

    res
      .status(500)
      .json({ message: "Failed to fetch image", error: error.message });
  }
});

// Fetch and save posts for a specific account
router.post("/:accountId/fetch", fetchAndSavePosts);

// Get all posts for a specific account
router.get("/:accountId", getPostsForAccount);

module.exports = router;
