const express = require("express");
const {
  getDashboardStats,
  getRecentMentions,
  getTimeline,
  getAccounts,
} = require("../controllers/dashboardController");

const router = express.Router();

router.get("/stats", getDashboardStats);
router.get("/mentions", getRecentMentions);
router.get("/timeline", getTimeline);
router.get("/accounts", getAccounts);

module.exports = router;
