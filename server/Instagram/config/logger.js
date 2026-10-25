const winston = require('winston');
const fs = require('fs');
const path = require('path');

const logsDirectory = path.join(__dirname, '../logs');
fs.mkdirSync(logsDirectory, { recursive: true });

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => (
    `[${timestamp}] ${level.toUpperCase()}: ${stack || message}`
  )),
);

module.exports = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  format,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(logsDirectory, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logsDirectory, 'combined.log'),
    }),
  ],
});
