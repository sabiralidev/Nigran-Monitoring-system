/**
 * Convert CDN URLs to proxy URLs to bypass CORS restrictions
 * Supports Instagram, Facebook, and other CDN URLs
 * @param {string} imageUrl - The original CDN image/video URL
 * @param {string} mediaType - Type of media: 'image' or 'video'
 * @returns {string} - The proxied image URL or original URL if not applicable
 */
export const getProxiedImageUrl = (imageUrl, mediaType = "image") => {
  if (!imageUrl) return null;

  const normalizedUrl = typeof imageUrl === "string" ? imageUrl.trim() : "";
  if (!normalizedUrl) return null;

  // If it's already a proxy URL or our own host, return as-is
  if (
    normalizedUrl.includes(location.hostname) ||
    normalizedUrl.includes("10.10.1.220") ||
    normalizedUrl.includes("localhost") ||
    normalizedUrl.includes("127.0.0.1")
  ) {
    return normalizedUrl;
  }

  // Facebook/CDN URLs are often blocked when fetched server-side, so use the
  // original URL directly to avoid repeated proxy 403 failures.
  const isFacebookMediaUrl =
    normalizedUrl.includes("facebook.com") ||
    normalizedUrl.includes("fbcdn.net") ||
    normalizedUrl.includes("scontent") ||
    normalizedUrl.includes("fbsbx") ||
    normalizedUrl.includes("fbstatic.com");

  if (isFacebookMediaUrl) {
    return normalizedUrl;
  }

  // Instagram videos: proxy through backend for reliable playback
  if (mediaType === "video") {
    if (
      normalizedUrl.includes("cdninstagram.com") ||
      normalizedUrl.includes("instagram.com") ||
      normalizedUrl.includes("fbcdn.net")
    ) {
      const encodedUrl = encodeURIComponent(normalizedUrl);
      return `http://${location.hostname}:5003/instagram/posts/proxy/video?url=${encodedUrl}`;
    }

    if (
      normalizedUrl.includes("tiktokcdn") ||
      normalizedUrl.includes("tiktokv.com") ||
      normalizedUrl.includes("tiktok.com") ||
      normalizedUrl.includes("ttcdn") ||
      normalizedUrl.includes("akamaized.net")
    ) {
      const encodedUrl = encodeURIComponent(normalizedUrl);
      return `http://${location.hostname}:5004/tiktok/posts/proxy/video?url=${encodedUrl}`;
    }
  }

  // For data URLs, return as-is
  if (normalizedUrl.startsWith("data:")) {
    return normalizedUrl;
  }

  // For images: Use appropriate proxy to bypass CORS
  if (
    normalizedUrl.includes("cdninstagram.com") ||
    normalizedUrl.includes("instagram.com")
  ) {
    // Route to Instagram server on port 5003
    const encodedUrl = encodeURIComponent(normalizedUrl);
    return `http://${location.hostname}:5003/instagram/posts/proxy/image?url=${encodedUrl}`;
  }

  if (
    normalizedUrl.includes("tiktokcdn") ||
    normalizedUrl.includes("tiktokv.com") ||
    normalizedUrl.includes("tiktok.com") ||
    normalizedUrl.includes("ttcdn") ||
    normalizedUrl.includes("akamaized.net")
  ) {
    const encodedUrl = encodeURIComponent(normalizedUrl);
    return `http://${location.hostname}:5004/tiktok/posts/proxy/image?url=${encodedUrl}`;
  }

  // For other HTTP(S) URLs, try Facebook proxy as fallback
  if (
    normalizedUrl.startsWith("http://") ||
    normalizedUrl.startsWith("https://")
  ) {
    const encodedUrl = encodeURIComponent(normalizedUrl);
    return `http://${location.hostname}:5001/facebook/posts/proxy/image?url=${encodedUrl}`;
  }

  return normalizedUrl;
};
