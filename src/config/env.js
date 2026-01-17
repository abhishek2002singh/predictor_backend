const path = require('path');
const dotenv = require('dotenv');

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.prod'
    : '.env.dev';

dotenv.config({
  path: path.resolve(process.cwd(), envFile),
});

module.exports = {
  env: process.env.NODE_ENV,
};
