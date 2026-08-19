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

async function findLatestClosedSession(transaction) {
  return CashSessions.findOne({
    where: {
      status: "CLOSED",
    },
    order: [["closedAt", "DESC"], ["idCashSession", "DESC"]],
    transaction,
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

async function findLatestSessionOpenedOnOrBefore(referenceDate, transaction) {
  if (!referenceDate) return null;

  return CashSessions.findOne({
    where: {
      openedAt: {
        [Op.lt]: referenceDate,
      },
    },
    order: [["openedAt", "DESC"], ["idCashSession", "DESC"]],
    transaction,
  });
}

async function sumSessionEntriesBeforeDate(cashSessionId, beforeDate, transaction) {
  if (!cashSessionId || !beforeDate) {
    return { totalIn: 0, totalOut: 0 };
  }

  const entries = await CashEntries.findAll({
    where: {
      cashSessionId,
      scope: "LOJA",
      occurredAt: {
        [Op.lt]: beforeDate,
      },
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

module.exports = {
  findOpenStoreSession,
  findLatestClosedSession,
  createSession,
  updateSession,
  sumSessionEntries,
  findSessionsByDateRange,
  findLatestSessionOpenedOnOrBefore,
  sumSessionEntriesBeforeDate,
};
