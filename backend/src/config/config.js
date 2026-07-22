const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const common = {
  use_env_variable: "DATABASE_URL",
  dialect: "postgres",
};

module.exports = {
  development: {
    ...common,
    logging: console.log,
  },

  test: {
    ...common,
    logging: false,
  },

  staging: {
    ...common,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false,
  },

  production: {
    ...common,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false,
  },
};