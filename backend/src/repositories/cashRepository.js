const { Op } = require("sequelize");
const { CashEntries, sequelize } = require("../models");

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
  return CashEntries.findAndCountAll({
    where: buildWhere(filters),
    attributes: {
      include: [
        [
          sequelize.literal(`
            SUM(
              CASE
                WHEN "CashEntries"."movementType" = 'IN' THEN "CashEntries"."amount"
                ELSE -"CashEntries"."amount"
              END
            ) OVER (ORDER BY "CashEntries"."occurredAt" ASC, "CashEntries"."idCashEntry" ASC)
          `),
          "runningBalance",
        ],
      ],
    },
    order: [["occurredAt", "DESC"], ["idCashEntry", "DESC"]],
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize,
  });
}

async function summarizeEntries(filters = {}) {
  const [summary] = await CashEntries.findAll({
    where: buildWhere(filters),
    attributes: [
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN "CashEntries"."movementType" = 'IN' THEN "CashEntries"."amount" ELSE 0 END`),
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
            sequelize.literal(`CASE WHEN "CashEntries"."movementType" = 'OUT' THEN "CashEntries"."amount" ELSE 0 END`),
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
