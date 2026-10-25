const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getTotalVideoCount,
  getRecentMentions,
  getTimeline,
  getAccounts,
} = require('../controllers/dashboardController');

router.get('/stats', getDashboardStats);
router.get('/video-count', getTotalVideoCount);
router.get('/mentions', getRecentMentions);
router.get('/timeline', getTimeline);
router.get('/accounts', getAccounts);

module.exports = router;
