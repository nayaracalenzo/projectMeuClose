
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

console.log(process.env.DATABASE_URL)
module.exports = {
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgresql',
  },
  test: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgresql',
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgresql',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false,
  }
};