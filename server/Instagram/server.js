require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const connectDB = require("./config/db");
const accountRoutes = require("./routes/accounts");
const postRoutes = require("./routes/posts");
const alertRoutes = require("./routes/alerts");
const dashboardRoutes = require("./routes/dashboard");
const { initializeSocket } = require("./socket/socketManager");
const { startMonitoring } = require("./jobs/monitoringJob");
const { stopMonitoring } = require("./jobs/monitoringJob");
const { closeBrowser } = require("./scraper/browser");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Connect to database
connectDB();

// CORS configuration - MUST come early
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: false,
    optionsSuccessStatus: 200,
  }),
);

// Middleware
app.use(express.json());

// Routes
app.use("/instagram/accounts", accountRoutes);
app.use("/instagram/posts", postRoutes);
app.use("/instagram/alerts", alertRoutes);
app.use("/instagram/dashboard", dashboardRoutes);

const PORT = process.env.PORT || 5003;

server.listen(PORT, () => {
  console.log(`Instagram service running on port ${PORT}`);
  // Start the monitoring job
  startMonitoring();
});

process.on("SIGTERM", async () => {
  stopMonitoring();
  await closeBrowser();
  server.close(() => process.exit(0));
});
