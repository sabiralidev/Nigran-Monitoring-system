const MonitoredAccount = require("../models/MonitoredAccount");
const Alert = require("../models/Alert");
const { triggerApifyActor, parseTikTokProfileInput } = require("../services/tiktokService");

exports.addAccount = async (req, res) => {
  const { url, username: rawUsername } = req.body;
  const profileInput = url || rawUsername;

  if (!profileInput) {
    return res
      .status(400)
      .json({ msg: "Please provide a TikTok profile URL or username" });
  }

  const { username, isValid } = parseTikTokProfileInput(profileInput);
  if (!isValid || !username) {
    return res.status(400).json({ msg: "Invalid TikTok profile URL or username" });
  }

  try {
    let account = await MonitoredAccount.findOne({
      username,
      platform: "tiktok",
    });

    if (account) {
      return res.status(400).json({ msg: "Account already exists" });
    }

    account = new MonitoredAccount({
      username,
      platform: "tiktok",
    });

    await account.save();

    try {
      await triggerApifyActor(username, { resultsPerPage: 1 });
      account = await MonitoredAccount.findOne({ username, platform: "tiktok" });
    } catch (apifyError) {
      console.warn(
        `Apify fetch failed for ${username}, but account created:`,
        apifyError.message,
      );
    }

    res.status(201).json({ ...account.toObject(), alertCount: 0 });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

exports.getAccounts = async (req, res) => {
  try {
    const accounts = await MonitoredAccount.find({ platform: "tiktok" });

    const enrichedAccounts = await Promise.all(
      accounts.map(async (account) => {
        const alertCount = await Alert.countDocuments({
          accountId: account._id,
          platform: "tiktok",
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

    await Alert.deleteMany({ accountId: req.params.id, platform: "tiktok" });

    res.json({ success: true, message: "Account removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.updateAccountStatus = async (req, res) => {
  const { monitoringStatus } = req.body;

  if (!["active", "paused", "error"].includes(monitoringStatus)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid monitoring status" });
  }

  try {
    const account = await MonitoredAccount.findByIdAndUpdate(
      req.params.id,
      { monitoringStatus },
      { new: true },
    );

    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }

    res.json({
      success: true,
      message: "Account status updated",
      monitoringStatus: account.monitoringStatus,
    });
  } catch (err) {
    console.error("Error updating account status:", err);
    res.status(500).json({
      success: false,
      message: "Server error while updating account status",
    });
  }
};

exports.refreshAccount = async (req, res) => {
  try {
    const account = await MonitoredAccount.findById(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }

    triggerApifyActor(account.username, { resultsPerPage: 1 }).catch((error) => {
      console.error("Async refresh failed for", account.username, error);
    });

    account.lastChecked = new Date();
    await account.save();

    res.json({ success: true, message: "Refresh started", account });
  } catch (err) {
    console.error("Error refreshing account:", err);
    res.status(500).json({
      success: false,
      message: "Server error while refreshing account",
    });
  }
};

