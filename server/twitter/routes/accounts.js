const express = require('express');
const router = express.Router();
const {
  addAccount,
  getAccounts,
  getAccount,
  updateStatus,
  refreshAccount,
  removeAccount,
  getAccountStats,
} = require('../controllers/accountController');
router.route('/').get(getAccounts).post(addAccount);
router.route('/:id').get(getAccount).delete(removeAccount);
router.put('/:id/status', updateStatus);
router.put('/:id/refresh', refreshAccount);
router.get('/:id/stats', getAccountStats);

module.exports = router;
