
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

console.log(process.env.DATABASE_URL)
module.exports = {
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
  },
  test: {
    url: String(process.env.DATABASE_URL),
    dialect: 'postgres'
  },
  production: {
    url: String(process.env.DATABASE_URL),
    dialect: 'postgres',
    logging: false
  }
};