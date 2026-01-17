const morgan = require('morgan');
const logger = require('../config/logger');

const stream = {
  write: (message) => logger.http(message.trim()),
};

const morganMiddleware = morgan(
  ':method :url :status :response-time ms',
  { stream }
);

module.exports = morganMiddleware;
