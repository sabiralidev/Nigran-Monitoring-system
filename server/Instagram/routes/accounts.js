const express = require("express");
const router = express.Router();
const accountController = require("../controllers/accountController");

router.post("/", accountController.addAccount);
router.get("/", accountController.getAccounts);
router.delete("/:id", accountController.removeAccount);
router.patch('/:id/status', accountController.updateAccountStatus);
router.put('/:id/refresh', accountController.refreshAccount);

module.exports = router;
