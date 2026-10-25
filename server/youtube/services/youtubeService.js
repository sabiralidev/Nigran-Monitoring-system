const axios = require('axios');

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * Get channel uploads playlist ID
 */
const getChannelUploadsPlaylist = async (channelId) => {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
      params: {
        part: 'contentDetails,snippet,statistics',
        id: channelId,
        key: API_KEY,
      },
    });

    if (response.data.items && response.data.items.length > 0) {
      const channel = response.data.items[0];
      const thumbnails = channel.snippet.thumbnails;
      // Get highest quality profile image available
      const profileImage = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url;
      return {
        uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
        channelName: channel.snippet.title,
        description: channel.snippet.description,
        profileImage: profileImage,
        subscriberCount: parseInt(channel.statistics.subscriberCount) || 0,
        videoCount: parseInt(channel.statistics.videoCount) || 0,
      };
    }
    throw new Error('Channel not found');
  } catch (error) {
    console.error('Error fetching channel details:', error.message);
    throw error;
  }
};

/**
 * Get latest video from a playlist
 */
const getLatestVideoFromPlaylist = async (playlistId, maxResults = 1) => {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/playlistItems`, {
      params: {
        part: 'snippet,contentDetails',
        playlistId: playlistId,
        maxResults: maxResults,
        order: 'date',
        key: API_KEY,
      },
    });

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items.map((item) => ({
        videoId: item.contentDetails.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
        publishedAt: new Date(item.snippet.publishedAt),
        channelId: item.snippet.channelId,
        channelName: item.snippet.channelTitle,
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching playlist items:', error.message);
    throw error;
  }
};

/**
 * Get detailed video statistics
 */
const getVideoStatistics = async (videoId) => {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
      params: {
        part: 'statistics',
        id: videoId,
        key: API_KEY,
      },
    });

    if (response.data.items && response.data.items.length > 0) {
      const stats = response.data.items[0].statistics;
      return {
        viewCount: parseInt(stats.viewCount) || 0,
        likeCount: parseInt(stats.likeCount) || 0,
        commentCount: parseInt(stats.commentCount) || 0,
      };
    }
    return {
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
    };
  } catch (error) {
    console.error('Error fetching video statistics:', error.message);
    // Return default stats if API call fails
    return {
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
    };
  }
};

/**
 * Build video URL
 */
const buildVideoUrl = (videoId) => {
  return `https://www.youtube.com/watch?v=${videoId}`;
};

module.exports = {
  getChannelUploadsPlaylist,
  getLatestVideoFromPlaylist,
  getVideoStatistics,
  buildVideoUrl,
};
