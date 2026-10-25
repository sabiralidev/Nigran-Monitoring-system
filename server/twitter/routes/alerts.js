const express = require('express');
const router = express.Router();
const {
  getAlerts,
  getAlert,
  markRead,
  markAllRead,
  markOneViewed,
  getUnreadCount,
  deleteAlert,
  deleteAllAlerts,
  getDashboardStats,
} = require('../controllers/alertController');

router.get('/stats', getDashboardStats);
router.get('/unread-count', getUnreadCount);
router.put('/mark-all-read', markAllRead);
router.route('/').get(getAlerts).delete(deleteAllAlerts);
router.put('/mark-read', markRead);
router.put('/:id/viewed', markOneViewed);
router.route('/:id').get(getAlert).delete(deleteAlert);

module.exports = router;
