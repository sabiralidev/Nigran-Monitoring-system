require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const connectDB = require("./config/db");
const accountRoutes = require("./routes/accounts");
const postRoutes = require("./routes/posts");
const alertRoutes = require("./routes/alerts");
const { initializeSocket } = require("./socket/socketManager");
const { startMonitoring } = require("./jobs/monitoringJob");

const app = express();
const server = http.createServer(app);

initializeSocket(server);
connectDB();

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

app.use(express.json());

app.use("/tiktok/accounts", accountRoutes);
app.use("/tiktok/posts", postRoutes);
app.use("/tiktok/alerts", alertRoutes);

const PORT = process.env.PORT || 5004;

server.listen(PORT, () => {
  console.log(`TikTok service running on port ${PORT}`);
  startMonitoring();
});

