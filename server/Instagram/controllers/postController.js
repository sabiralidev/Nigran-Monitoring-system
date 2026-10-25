const MonitoredAccount = require('../models/MonitoredAccount');
const Alert = require('../models/Alert');
const { fetchAndSaveAccountPosts } = require('../services/instagramService');

const fetchAndSavePosts = async (req, res) => {
  try {
    const account = await MonitoredAccount.findOne({
      _id: req.params.accountId,
      platform: 'instagram',
    });
    if (!account) return res.status(404).json({ message: 'Account not found' });

    const { saved } = await fetchAndSaveAccountPosts(account, 10);
    return res.status(saved.length ? 201 : 200).json(
      saved.length ? saved : { message: 'No new posts found.' },
    );
  } catch (error) {
    console.error('Error fetching and saving Instagram posts:', error);
    return res.status(500).json({ message: error.message || 'Error fetching and saving posts' });
  }
};

const getPostsForAccount = async (req, res) => {
  try {
    const alerts = await Alert.find({
      accountId: req.params.accountId,
      platform: 'instagram',
    }).sort({ timestamp: -1 });
    return res.status(200).json(alerts);
  } catch (error) {
    console.error('Error getting Instagram posts:', error);
    return res.status(500).json({ message: 'Error getting posts' });
  }
};

module.exports = { fetchAndSavePosts, getPostsForAccount };
