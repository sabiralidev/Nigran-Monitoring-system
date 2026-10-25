const cron = require("node-cron");
const MonitoredAccount = require("../models/MonitoredAccount");
const {
  triggerApifyActor,
  detectPostType,
} = require("../services/facebookService");
const { getIO } = require("../socket/socketManager");
const Alert = require("../models/Alert");

let fetchInProgress = false;

const fetchLatestPosts = async () => {
  if (fetchInProgress) {
    console.log("Skipping monitoring run because the previous run is still in progress.");
    return;
  }

  fetchInProgress = true;
  console.log("Running job: Fetching latest posts for all accounts.");
  try {
    const accounts = await MonitoredAccount.find({ platform: "facebook" });
    if (!accounts || accounts.length === 0) {
      console.log("No accounts to monitor.");
      return;
    }

    // Extract all usernames to fetch in a single API call
    const usernames = accounts.map((account) => account.username);
    console.log(
      `Fetching posts for ${usernames.length} accounts in a single batch:`,
      usernames.join(", "),
    );

    try {
      // Trigger Apify actor once for all usernames
      const posts = await triggerApifyActor(usernames);

      if (posts && posts.length > 0) {
        console.log(`Processing ${posts.length} posts from batch Apify run.`);

        // Create a map of accounts by username for quick lookup (case-insensitive)
        const accountsByUsername = {};
        accounts.forEach((account) => {
          accountsByUsername[account.username.toLowerCase()] = account;
        });

        console.log(
          "Available usernames in database:",
          Object.keys(accountsByUsername),
        );

        // Process each returned post
        for (const post of posts) {
          try {
            // Skip posts with errors (private, deleted, etc.)
            if (post.error) {
              console.warn(
                `Skipping post from ${post.url} - Error: ${post.error} (${post.errorDescription})`,
              );
              continue;
            }

            // Find the corresponding account for this post
            const sourceUsername = post.sourceUsername;

            if (!sourceUsername) {
              console.warn(`Could not extract username from post. Skipping.`);
              continue;
            }

            const matchedAccount =
              accountsByUsername[sourceUsername.toLowerCase()];

            if (!matchedAccount) {
              console.warn(
                `No account found for username "${sourceUsername}". Skipping.`,
              );
              continue;
            }

            console.log(
              `✓ Matched post to account: ${matchedAccount.username}`,
            );

            // Update account profile data to keep it fresh
            if (post.user) {
              const displayName = post.user.name || matchedAccount.username;
              const profileImage = post.user.profilePic || post.user.photo;

              await MonitoredAccount.updateOne(
                { _id: matchedAccount._id },
                {
                  displayName: displayName,
                  profileImage: profileImage,
                  lastChecked: new Date(),
                  monitoringStatus: "active", // Mark as active when successfully fetching
                },
              );
            }

            // Check if the post already exists in alerts
            const existingAlert = await Alert.findOne({ postId: post.postId });

            if (!existingAlert) {
              const alertData = {
                platform: "facebook",
                source: matchedAccount.username,
                // Author information
                authorUsername:
                  post.user?.username || post.user?.name || "Unknown",
                authorDisplayName:
                  post.user?.name || post.user?.username || "Unknown",
                authorProfilePic: post.user?.profilePic || post.user?.photo,
                // Post content
                content: post.text,
                url: post.url,
                postId: post.postId,
                accountId: matchedAccount._id,
                likes: post.likes || 0,
                shares: post.shares || 0,
                comments: post.comments || 0,
                mediaUrl: post.mediaUrl,
                timestamp: post.time,
                profilePic: post.user?.profilePic,
                media: post.media,
                postType: detectPostType(post.media), // Detect and store post type
              };

              const newAlert = new Alert(alertData);
              const savedAlert = await newAlert.save();
              console.log("New post saved as alert:", savedAlert._id);

              // Increment alert count for this account
              await MonitoredAccount.updateOne(
                { _id: matchedAccount._id },
                { $inc: { alertCount: 1 } },
              );

              // Emit a notification for the new post
              const io = getIO();
              io.emit("new_facebook_alert", savedAlert);
            } else {
              console.log(`Post ${post.postId} already exists. Skipping.`);
            }
          } catch (postError) {
            console.error(`Error processing post:`, postError);
          }
        }
      }

      // Mark all accounts as successfully checked
      await MonitoredAccount.updateMany(
        { platform: "facebook" },
        { monitoringStatus: "active", lastChecked: new Date() },
      );
    } catch (batchError) {
      console.error(`Error during batch Apify run:`, batchError);
      // Mark all accounts as error if batch fetch fails
      await MonitoredAccount.updateMany(
        { platform: "facebook" },
        { monitoringStatus: "error", lastChecked: new Date() },
      );
    }
  } catch (error) {
    console.error("Error during post fetching:", error);
  } finally {
    fetchInProgress = false;
  }
};

const startMonitoring = () => {
  // Run immediately on server start
  fetchLatestPosts();

  // Schedule a job to run every 15 minutes
  cron.schedule("*/15 * * * *", fetchLatestPosts);
};

module.exports = { startMonitoring };
