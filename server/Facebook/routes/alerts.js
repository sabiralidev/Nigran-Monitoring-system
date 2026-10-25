const express = require("express");
const {
  getAlerts,
  getAlert,
  markAllAlertsRead,
  markOneViewed,
} = require("../controllers/alertController");

const router = express.Router();
router.route("/").get(getAlerts);
router.route("/mark-all-read").put(markAllAlertsRead);
router.route("/:id/viewed").put(markOneViewed);
router.route("/:id").get(getAlert);

module.exports = router;
