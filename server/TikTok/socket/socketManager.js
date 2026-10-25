const { Server } = require("socket.io");

let io = null;

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join_monitoring", () => {
      socket.join("monitoring_room");
      console.log(`Socket ${socket.id} joined monitoring room`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} - ${reason}`);
    });

    socket.on("error", (error) => {
      console.error(`Socket error: ${error.message}`);
    });
  });

  console.log("Socket.io server initialized");
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = { initializeSocket, getIO, emitToAll };
