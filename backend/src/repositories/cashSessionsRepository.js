const { Op } = require("sequelize");
const { CashEntries, CashSessions } = require("../models");

async function findOpenStoreSession(transaction) {
  return CashSessions.findOne({
    where: {
      status: "OPEN",
    },
    order: [["openedAt", "ASC"], ["idCashSession", "ASC"]],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
}

async function createSession(payload, transaction) {
  return CashSessions.create(payload, { transaction });
}

async function updateSession(session, payload, transaction) {
  await session.update(payload, { transaction });
  return session;
}

async function sumSessionEntries(cashSessionId, transaction) {
  const entries = await CashEntries.findAll({
    where: {
      cashSessionId,
      scope: "LOJA",
    },
    attributes: ["movementType", "amount"],
    transaction,
  });

  return entries.reduce(
    (acc, item) => {
      const amount = Number(item.amount || 0);
      if (item.movementType === "IN") {
        acc.totalIn += amount;
      } else {
        acc.totalOut += amount;
      }
      return acc;
    },
    { totalIn: 0, totalOut: 0 },
  );
}

async function findSessionsByDateRange({ fromDate, toDate }) {
  const where = {};

  if (fromDate || toDate) {
    where.openedAt = {};
    if (fromDate) where.openedAt[Op.gte] = fromDate;
    if (toDate) where.openedAt[Op.lte] = toDate;
  }

  return CashSessions.findAll({
    where,
    order: [["openedAt", "DESC"], ["idCashSession", "DESC"]],
  });
}

module.exports = {
  findOpenStoreSession,
  createSession,
  updateSession,
  sumSessionEntries,
  findSessionsByDateRange,
};
