const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');

// Channel routes
router.post('/', channelController.addChannel);
router.get('/', channelController.getChannels);
router.get('/:id', channelController.getChannelById);
router.delete('/:id', channelController.removeChannel);
router.patch('/:id/status', channelController.updateChannelStatus);
router.put('/:id/refresh', channelController.refreshChannel);

module.exports = router;
