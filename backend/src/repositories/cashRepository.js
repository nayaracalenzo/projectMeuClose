const { Op } = require("sequelize");
const { CashEntries } = require("../models");

function buildWhere({ scope, search, startDate, endDate } = {}) {
  const where = {};

  if (scope) {
    where.scope = scope;
  }

  if (startDate || endDate) {
    where.occurredAt = {};

    if (startDate) {
      where.occurredAt[Op.gte] = startDate;
    }

    if (endDate) {
      where.occurredAt[Op.lte] = endDate;
    }
  }

  if (search) {
    where.description = {
      [Op.iLike]: `%${search}%`,
    };
  }

  return where;
}

async function createEntry(payload, transaction) {
  return CashEntries.create(payload, { transaction });
}

async function listEntries(filters = {}) {
  return CashEntries.findAll({
    where: buildWhere(filters),
    order: [["occurredAt", "DESC"], ["idCashEntry", "DESC"]],
  });
}

module.exports = {
  createEntry,
  listEntries,
};
