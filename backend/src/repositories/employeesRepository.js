const { Employees, Sequelize } = require("../models");

function buildBirthdayWhere({ month, year }) {
  const filters = [`EXTRACT(MONTH FROM "birthDate") = ${month}`];

  if (year) {
    filters.push(`EXTRACT(YEAR FROM "birthDate") = ${year}`);
  }

  return Sequelize.literal(filters.join(" AND "));
}

async function findBirthdays({ month, year }) {
  return Employees.findAll({
    where: buildBirthdayWhere({ month, year }),
    order: [["birthDate", "ASC"], ["fullName", "ASC"]],
  });
}

module.exports = {
  findBirthdays,
};
