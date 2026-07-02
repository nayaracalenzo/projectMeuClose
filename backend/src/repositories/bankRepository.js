const { Op } = require("sequelize");
const { BankEntries } = require("../models");

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
    where[Op.or] = [
      {
        description: {
          [Op.iLike]: `%${search}%`,
        },
      },
      {
        category: {
          [Op.iLike]: `%${search}%`,
        },
      },
      {
        accountLabel: {
          [Op.iLike]: `%${search}%`,
        },
      },
    ];
  }

  return where;
}

async function createEntry(payload, transaction) {
  return BankEntries.create(payload, { transaction });
}

async function listEntries(filters = {}) {
  return BankEntries.findAll({
    where: buildWhere(filters),
    order: [["occurredAt", "DESC"], ["idBankEntry", "DESC"]],
  });
}

module.exports = {
  createEntry,
  listEntries,
};
