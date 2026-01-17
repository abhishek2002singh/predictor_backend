require('./config/env');

const app = require('./app');
const { database_connection } = require('./config/database');
const logger = require('./config/logger');

const PORT = process.env.PORT || 7777;

const startServer = async () => {
  await database_connection();

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

startServer();
