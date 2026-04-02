const { Customers, Sequelize } = require('../models');

async function getAllClients() {
  return Customers.findAll({
    order: [["fullName", "ASC"]],
  });
}

async function findBirthdaysOfMonth() {
  const currentMonth = new Date().getMonth() + 1;

  return Customers.findAll({
    where: Sequelize.literal(
      `EXTRACT(MONTH FROM "birthDate") = ${currentMonth}`
    ),
    order: [["birthDate", "ASC"]],
  });
}

module.exports = { getAllClients, findBirthdaysOfMonth };