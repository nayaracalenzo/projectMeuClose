const { Customers, Professions, Sequelize } = require("../models");

function buildBirthdayWhere({ month, year }) {
  const filters = [`EXTRACT(MONTH FROM "birthDate") = ${month}`];

  if (year) {
    filters.push(`EXTRACT(YEAR FROM "birthDate") = ${year}`);
  }

  return Sequelize.literal(filters.join(" AND "));
}

async function getAllClients() {
  return Customers.findAll({
    order: [["fullName", "ASC"]],
  });
}

async function findBirthdays({ month, year }) {
  return Customers.findAll({
    where: buildBirthdayWhere({ month, year }),
    order: [["birthDate", "ASC"], ["fullName", "ASC"]],
  });
}

async function getClientById(id) {
  return Customers.findByPk(id, {
    include: [
      {
        model: Professions,
        attributes: ["idProfession", "nameProfession"],
        required: false,
      },
    ],
  });
}

async function updateClientById(id, payload) {
  const client = await Customers.findByPk(id);
  if (!client) return null;

  await client.update(payload);
  return client;
}

async function createClient(payload) {
  return Customers.create(payload);
}

module.exports = {
  getAllClients,
  findBirthdays,
  getClientById,
  updateClientById,
  createClient,
};
