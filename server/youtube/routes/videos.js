const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

// Video routes
router.get('/', videoController.getAllVideos);
router.patch('/mark-all-viewed', videoController.markAllVideosAsViewed);
router.get('/channel/:channelId', videoController.getVideosByChannel);
router.get('/stats', videoController.getVideoStats);
router.get('/:videoId', videoController.getVideoById);
router.patch('/:videoId/viewed', videoController.markVideoAsViewed);

module.exports = router;
