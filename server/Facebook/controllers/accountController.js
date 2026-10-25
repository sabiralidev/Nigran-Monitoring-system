const MonitoredAccount = require("../models/MonitoredAccount");
const Alert = require("../models/Alert");
const { triggerApifyActor } = require("../services/facebookService");

const extractUsername = (url) => {
  try {
    const urlObject = new URL(url);
    let username = urlObject.pathname.split("/").filter(Boolean).pop();
    if (username) {
      // Handle cases like /pages/username/12345
      if (urlObject.pathname.includes("/pages/")) {
        username = urlObject.pathname.split("/")[2];
      }
      // remove query params
      username = username.split("?")[0];
    }
    return username;
  } catch (error) {
    // If not a valid URL, assume it's a username
    return url.replace("@", "");
  }
};

exports.addAccount = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res
      .status(400)
      .json({ msg: "Please provide a Facebook URL or username" });
  }

  const username = extractUsername(url);

  if (!username) {
    return res.status(400).json({ msg: "Invalid Facebook URL or username" });
  }

  try {
    let account = await MonitoredAccount.findOne({
      username,
      platform: "facebook",
    });

    if (account) {
      return res.status(400).json({ msg: "Account already exists" });
    }

    account = new MonitoredAccount({
      username,
      platform: "facebook",
    });

    await account.save();

    // Trigger the Apify actor and wait for profile data to be populated
    try {
      await triggerApifyActor(username);
      // Refresh the account to get updated profile data
      account = await MonitoredAccount.findOne({
        username,
        platform: "facebook",
      });
    } catch (apifyError) {
      console.warn(`Apify fetch failed for ${username}, but account created:`, apifyError.message);
      // Account was created even if Apify failed, which is okay
    }

    res.status(201).json(account);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

exports.getAccounts = async (req, res) => {
  try {
    const accounts = await MonitoredAccount.find({ platform: "facebook" });
    
    // Enrich accounts with alert counts from the Alert collection
    const enrichedAccounts = await Promise.all(
      accounts.map(async (account) => {
        const alertCount = await Alert.countDocuments({
          accountId: account._id,
          platform: 'facebook'
        });
        
        const accountObj = account.toObject ? account.toObject() : account;
        return {
          ...accountObj,
          alertCount: alertCount
        };
      })
    );
    
    res.json(enrichedAccounts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

exports.removeAccount = async (req, res) => {
  try {
    const account = await MonitoredAccount.findByIdAndDelete(req.params.id);

    if (!account) {
      return res.status(404).json({ msg: "Account not found" });
    }

    await Alert.deleteMany({
      $or: [
        { accountId: account._id },
        { platform: "facebook", source: account.username },
        { platform: "facebook", authorUsername: account.username },
      ],
    });

    res.json({ success: true, message: "Account removed" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Account not found" });
    }
    res.status(500).send("Server Error");
  }
};

/**
 * Update monitoring status for an account
 * PATCH /accounts/:id/status
 */
exports.updateAccountStatus = async (req, res) => {
  const { monitoringStatus } = req.body;

  if (!['active', 'paused', 'error'].includes(monitoringStatus)) {
    return res.status(400).json({ success: false, message: 'Invalid monitoring status' });
  }

  try {
    const account = await MonitoredAccount.findByIdAndUpdate(
      req.params.id,
      { monitoringStatus },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    res.json({ success: true, message: 'Account status updated', monitoringStatus: account.monitoringStatus });
  } catch (err) {
    console.error('Error updating account status:', err);
    res.status(500).json({ success: false, message: 'Server error while updating account status' });
  }
};

/**
 * Refresh account profile/metadata by running Apify actor
 * PUT /accounts/:id/refresh
 */
exports.refreshAccount = async (req, res) => {
  try {
    const account = await MonitoredAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    triggerApifyActor(account.username).catch((error) => {
      console.error('Async refresh failed for', account.username, error);
    });

    account.lastChecked = new Date();
    await account.save();

    res.json({ success: true, message: 'Account refreshed', account });
  } catch (err) {
    console.error('Error refreshing account:', err);
    res.status(500).json({ success: false, message: 'Server error while refreshing account' });
  }
};
