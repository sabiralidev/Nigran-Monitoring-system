const MonitoredAccount = require("../models/MonitoredAccount");
const Alert = require("../models/Alert");
const { fetchAccountProfile } = require("../services/instagramService");

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
      .json({ msg: "Please provide an Instagram URL or username" });
  }

  const username = extractUsername(url).replace(/^@/, "").trim().toLowerCase();

  if (!username) {
    return res.status(400).json({ msg: "Invalid Instagram URL or username" });
  }

  try {
    let account = await MonitoredAccount.findOne({
      username,
      platform: "instagram",
    });

    if (account) {
      return res.status(400).json({ msg: "Account already exists" });
    }

    account = new MonitoredAccount({
      username,
      platform: "instagram",
    });

    await account.save();

    // Fetch profile data after creating the account.
    try {
      await fetchAccountProfile(account);
      // Refresh the account to get updated profile data
      account = await MonitoredAccount.findOne({
        username,
        platform: "instagram",
      });
    } catch (profileError) {
      console.warn(
        `Profile fetch failed for ${username}, but account created:`,
        profileError.message,
      );
      // Account remains available for a later refresh.
    }

    res.status(201).json({ ...account.toObject(), alertCount: 0 });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

exports.getAccounts = async (req, res) => {
  try {
    const accounts = await MonitoredAccount.find({ platform: "instagram" });

    // Enrich accounts with alert counts from the Alert collection
    const enrichedAccounts = await Promise.all(
      accounts.map(async (account) => {
        const alertCount = await Alert.countDocuments({
          accountId: account._id,
        });

        const accountObj = account.toObject ? account.toObject() : account;
        return {
          ...accountObj,
          alertCount: alertCount ?? 0,
        };
      }),
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

    // Also delete all alerts associated with this account
    await Alert.deleteMany({ accountId: req.params.id });

    res.json({ success: true, message: "Account removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

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

exports.refreshAccount = async (req, res) => {
  try {
    const account = await MonitoredAccount.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    await fetchAccountProfile(account);
    const updatedAccount = await MonitoredAccount.findById(req.params.id);

    res.json({ success: true, message: 'Profile refreshed', account: updatedAccount });
  } catch (err) {
    console.error('Error refreshing account:', err);
    res.status(500).json({ success: false, message: 'Server error while refreshing account' });
  }
};
