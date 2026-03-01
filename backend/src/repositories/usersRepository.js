const { Users } = require("../models");

async function findUserByEmail(email) {
  return Users.findOne({ where: { email } });
}

async function createUser(data) {
  return Users.create(data);
}

module.exports = {
  findUserByEmail,
  createUser,
};