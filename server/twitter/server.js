require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");

const connectDB = require("./config/db");
const logger = require("./config/logger");
const { initializeSocket } = require("./socket/socketManager");
const { setSocketInstance } = require("./services/alertService");
const { startMonitoring } = require("./jobs/monitoringJob");
const { closeBrowser } = require("./scraper/browser");
const { errorHandler, notFound } = require("./middleware/errorHandler");

// Routes
const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/accounts");
const alertRoutes = require("./routes/alerts");
const dashboardRoutes = require("./routes/dashboard");

// Ensure logs directory exists
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = initializeSocket(server);
setSocketInstance(io);

// Connect to MongoDB
connectDB();

// CORS configuration - MUST come before other middleware
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

// Body parsing - AFTER CORS
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security middleware - AFTER body parsing and CORS
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  // Polling requests are expected for the dashboard. Count only failed
  // requests so normal polling cannot exhaust the API quota.
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Monitoring-X API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/dashboard", dashboardRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(
    `Monitoring-X Server running on port ${PORT} in ${process.env.NODE_ENV} mode`,
  );
  logger.info(`API available at http://localhost:${PORT}/api`);

  // Start background monitoring after server is up
  startMonitoring();
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received: shutting down gracefully");
  await closeBrowser();
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

module.exports = server;
