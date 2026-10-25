require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const connectDB = require('./config/db');
const channelRoutes = require('./routes/channels');
const videoRoutes = require('./routes/videos');
const dashboardRoutes = require('./routes/dashboard');
const { initializeSocket } = require('./socket/socketManager');
const { startMonitoring } = require('./jobs/monitoringJob');

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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 200,
  })
);

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'YouTube monitoring service is running',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/youtube/channels', channelRoutes);
app.use('/youtube/videos', videoRoutes);
app.use('/youtube/dashboard', dashboardRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Not found',
  });
});

const PORT = process.env.PORT || 5002;

server.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║  YouTube Monitoring Service            ║`);
  console.log(`║  Running on port ${PORT}                   ║`);
  console.log(`║  Environment: ${process.env.NODE_ENV || 'development'}         ║`);
  console.log(`╚════════════════════════════════════════╝\n`);

  // Start the monitoring job
  startMonitoring();
});
