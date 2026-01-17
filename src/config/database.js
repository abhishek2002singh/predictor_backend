const mongoose = require('mongoose');
const logger = require('./logger');

const database_connection = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed', {
      message: error.message,
    });
    process.exit(1);
  }
};

module.exports = { database_connection };
