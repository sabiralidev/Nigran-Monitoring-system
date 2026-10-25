const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getTotalAlertCount,
  getRecentMentions,
  getTimeline,
  getPlatformAccounts,
  getKeywords,
  addKeyword,
  removeKeyword,
  getMonitoringStatus,
} = require('../controllers/dashboardController');

router.get('/stats', getDashboardStats);
router.get('/alert-count', getTotalAlertCount);
router.get('/mentions', getRecentMentions);
router.get('/timeline', getTimeline);
router.get('/accounts', getPlatformAccounts);
router.get('/keywords', getKeywords);
router.post('/keywords', addKeyword);
router.delete('/keywords/:id', removeKeyword);
router.get('/monitoring-status', getMonitoringStatus);

module.exports = router;
