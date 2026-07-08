const { Op, Sequelize } = require("sequelize");
const { BankEntries, sequelize } = require("../models");

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
  return BankEntries.findAndCountAll({
    where: buildWhere(filters),
    order: [["occurredAt", "DESC"], ["idBankEntry", "DESC"]],
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize,
  });
}

async function summarizeEntries(filters = {}) {
  const [summary] = await BankEntries.findAll({
    where: buildWhere(filters),
    attributes: [
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN "BankEntries"."movementType" = 'IN' THEN "BankEntries"."amount" ELSE 0 END`),
          ),
          0,
        ),
        "totalIn",
      ],
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN "BankEntries"."movementType" = 'OUT' THEN "BankEntries"."amount" ELSE 0 END`),
          ),
          0,
        ),
        "totalOut",
      ],
    ],
    raw: true,
  });

  return {
    totalIn: Number(summary?.totalIn || 0),
    totalOut: Number(summary?.totalOut || 0),
  };
}

module.exports = {
  createEntry,
  listEntries,
  summarizeEntries,
};
