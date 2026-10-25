const cron = require("node-cron");
const MonitoredAccount = require("../models/MonitoredAccount");
const Alert = require("../models/Alert");
const {
  getChannelUploadsPlaylist,
  getLatestVideoFromPlaylist,
  getVideoStatistics,
  buildVideoUrl,
} = require("../services/youtubeService");
const { getIO } = require("../socket/socketManager");

const avatarCache = new Map();
const AVATAR_TTL_MS = 6 * 60 * 60 * 1000;

const checkForNewVideos = async () => {
  console.log(
    `[${new Date().toISOString()}] Running job: Checking for new YouTube videos...`,
  );
  try {
    const accounts = await MonitoredAccount.find({ platform: "youtube" });
    if (!accounts || accounts.length === 0) {
      console.log("No YouTube channels to monitor.");
      return;
    }

    for (const account of accounts) {
      if (account.monitoringStatus === "paused") {
        console.log(
          `Skipping channel ${account.channelName} - status: ${account.monitoringStatus}`,
        );
        continue;
      }

      console.log(`\n[${account.channelName}] Checking for new videos...`);
      try {
        let latestProfileImage = account.profileImage;
        const cached = avatarCache.get(account.channelId);
        if (
          cached?.url &&
          typeof cached.fetchedAt === "number" &&
          Date.now() - cached.fetchedAt < AVATAR_TTL_MS
        ) {
          latestProfileImage = cached.url;
        } else {
          try {
            const channelInfo = await getChannelUploadsPlaylist(
              account.channelId,
            );
            if (channelInfo?.profileImage) {
              latestProfileImage = channelInfo.profileImage;
              avatarCache.set(account.channelId, {
                url: latestProfileImage,
                fetchedAt: Date.now(),
              });
            }
          } catch (e) {
            console.warn(
              `  ⚠️  Could not refresh channel avatar for ${account.channelName}:`,
              e.message,
            );
          }
        }

        if (
          latestProfileImage &&
          latestProfileImage !== account.profileImage
        ) {
          await MonitoredAccount.updateOne(
            { _id: account._id },
            { profileImage: latestProfileImage },
          );
          await Alert.updateMany(
            { platform: "youtube", channelId: account.channelId },
            { $set: { channelProfileImage: latestProfileImage } },
          );
        }

        // Get latest video from uploads playlist
        const videos = await getLatestVideoFromPlaylist(
          account.uploadsPlaylistId,
          1,
        );

        if (videos && videos.length > 0) {
          const latestVideo = videos[0];
          console.log(
            `  Latest video: "${latestVideo.title}" (${latestVideo.videoId})`,
          );
          console.log(`  Last tracked: ${account.lastVideoId}`);

          // Update last checked time
          await MonitoredAccount.updateOne(
            { _id: account._id },
            {
              lastChecked: new Date(),
              monitoringStatus: "active",
            },
          );

          // Check if this is a new video we haven't seen before
          if (latestVideo.videoId !== account.lastVideoId) {
            console.log(`  🆕 NEW VIDEO DETECTED!`);

            // Get video statistics
            const stats = await getVideoStatistics(latestVideo.videoId);

            // Create alert from this new video
            const alertData = {
              platform: "youtube",
              source: account.channelName, // The channel being monitored
              videoId: latestVideo.videoId,
              videoTitle: latestVideo.title,
              videoDescription: latestVideo.description,
              thumbnail: latestVideo.thumbnail,
              channelId: latestVideo.channelId,
              channelName: latestVideo.channelName,
              channelProfileImage: latestProfileImage,
              accountId: account._id,
              viewCount: stats.viewCount,
              likeCount: stats.likeCount,
              commentCount: stats.commentCount,
              url: buildVideoUrl(latestVideo.videoId),
              publishedAt: latestVideo.publishedAt,
              isRead: false,
              isViewed: false,
            };

            // Check if alert already exists (duplicate prevention)
            const existingAlert = await Alert.findOne({
              videoId: latestVideo.videoId,
              platform: "youtube",
            });

            if (!existingAlert) {
              // Save the new alert
              const newAlert = new Alert(alertData);
              const savedAlert = await newAlert.save();
              console.log(`  ✅ Alert saved: ${savedAlert._id}`);

              // Update account's last video ID and increment alert count
              await MonitoredAccount.updateOne(
                { _id: account._id },
                {
                  lastVideoId: latestVideo.videoId,
                  $inc: { alertCount: 1 },
                },
              );

              // Emit real-time notification via Socket.IO
              const io = getIO();
              io.emit("new_youtube_alert", {
                alert: savedAlert,
                message: `New video from ${account.channelName}: "${latestVideo.title}"`,
              });

              console.log(`  📡 Socket event emitted: new_youtube_alert`);
            } else {
              // Alert already exists, just update last video ID if needed
              if (account.lastVideoId !== latestVideo.videoId) {
                await MonitoredAccount.updateOne(
                  { _id: account._id },
                  { lastVideoId: latestVideo.videoId },
                );
              }
              console.log(`  ℹ️  Video already tracked as alert`);
            }
          } else {
            console.log(`  ℹ️  No new videos since last check`);
          }
        } else {
          console.log(`  ⚠️  No videos found in uploads playlist`);
        }
      } catch (accountError) {
        console.error(
          `❌ Error checking ${account.channelName}:`,
          accountError.message,
        );
        // Mark account as error
        await MonitoredAccount.updateOne(
          { _id: account._id },
          { monitoringStatus: "error", lastChecked: new Date() },
        );
      }
    }

    console.log(`\n[${new Date().toISOString()}] Job completed\n`);
  } catch (error) {
    console.error("💥 Critical error during job:", error);
  }
};

const startMonitoring = () => {
  // Run immediately on server start
  checkForNewVideos();
  
  // Schedule a job to run every 2 minutes
  // Format: "*/2 * * * *" = every 2 minutes
  cron.schedule("*/2 * * * *", checkForNewVideos);

  console.log("✅ YouTube monitoring job scheduled (every 2 minutes)");
};

module.exports = { startMonitoring };
