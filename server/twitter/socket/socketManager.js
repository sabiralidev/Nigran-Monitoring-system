const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

let io = null;

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      // Allow unauthenticated connections for now (frontend handles auth)
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      next(); // Allow connection even if token is invalid
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('join_monitoring', () => {
      socket.join('monitoring_room');
      logger.info(`Socket ${socket.id} joined monitoring room`);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} - ${reason}`);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error: ${error.message}`);
    });
  });

  logger.info('Socket.io server initialized');
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = { initializeSocket, getIO, emitToAll };
