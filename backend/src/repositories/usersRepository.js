const { Users } = require("../models");

async function findUserByEmail(email) {
  return Users.findOne({ where: { email } });
}

async function findUserByUsername(username) {
  return Users.findOne({ where: { username } });

}

async function createUser(data) {
  return Users.create(data);
}

module.exports = {
  findUserByEmail,
  findUserByUsername,
  createUser,
};
