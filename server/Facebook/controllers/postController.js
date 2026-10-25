const { triggerApifyActor, detectPostType } = require('../services/facebookService');
const MonitoredAccount = require('../models/MonitoredAccount');
const Alert = require('../models/Alert');

const { getIO } = require('../socket/socketManager');

const fetchAndSavePosts = async (req, res) => {
    try {
        const { accountId } = req.params;
        const account = await MonitoredAccount.findById(accountId);

        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const posts = await triggerApifyActor(account.username);

        if (posts && posts.length > 0) {
            const alertData = posts.map(post => ({
                platform: 'facebook',
                source: account.username,
                content: post.text,
                url: post.url,
                postId: post.postId,
                accountId: accountId,
                likes: post.likes || 0,
                shares: post.shares || 0,
                mediaUrl: post.mediaUrl,
                timestamp: post.time,
                profilePic: post.user?.profilePic,
                media: post.media,
                postType: detectPostType(post.media),
            }));

            const postIds = alertData.map((alert) => alert.postId).filter(Boolean);
            const existingAlerts = await Alert.find(
                { platform: 'facebook', postId: { $in: postIds } },
                { postId: 1, _id: 0 }
            ).lean();
            const existingPostIds = new Set(existingAlerts.map((alert) => alert.postId));
            const fetchedPostIds = new Set();
            const newAlertData = alertData.filter((alert) => {
                if (!alert.postId || existingPostIds.has(alert.postId) || fetchedPostIds.has(alert.postId)) {
                    return false;
                }

                fetchedPostIds.add(alert.postId);
                return true;
            });

            if (newAlertData.length === 0) {
                return res.status(200).json({ message: 'Posts already exist.' });
            }

            const savedAlerts = await Alert.insertMany(newAlertData, { ordered: false });
            
            // Update account profile data from the latest post
            if (posts[0] && posts[0].user) {
                const displayName = posts[0].user.name || account.username;
                const profileImage = posts[0].user.profilePic || posts[0].user.photo;
                
                await MonitoredAccount.updateOne(
                    { _id: accountId },
                    {
                        displayName: displayName,
                        profileImage: profileImage,
                        lastChecked: new Date(),
                    }
                );
            }
            
            // Increment alert count by the number of new alerts saved
            if (savedAlerts.length > 0) {
                await MonitoredAccount.updateOne(
                    { _id: accountId },
                    { $inc: { alertCount: savedAlerts.length } }
                );
                
                const io = getIO();
                savedAlerts.forEach(alert => {
                    io.emit('new_facebook_alert', alert);
                });
            }
            
            res.status(201).json(savedAlerts);
        } else {
            res.status(200).json({ message: 'No new posts found.' });
        }
    } catch (error) {
        if (error.code === 11000) {
            // This is a duplicate key error, which we can ignore.
            res.status(200).json({ message: 'Posts already exist.' });
        } else {
            console.error('Error fetching and saving posts:', error);
            res.status(500).json({ message: 'Error fetching and saving posts' });
        }
    }
};

const getPostsForAccount = async (req, res) => {
    try {
        const { accountId } = req.params;
        const alerts = await Alert.find({ accountId: accountId, platform: 'facebook' }).sort({ timestamp: -1 });
        res.status(200).json(alerts);
    } catch (error) {
        console.error('Error getting posts:', error);
        res.status(500).json({ message: 'Error getting posts' });
    }
};

module.exports = {
    fetchAndSavePosts,
    getPostsForAccount
};
