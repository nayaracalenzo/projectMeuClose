const {
  conflictError,
  notFoundError,
  validationError,
} = require("../errors/AppError");
const { sequelize } = require("../models");
const repository = require("../repositories/cashSessionsRepository");

function roundCurrency(value) {
  return Number(Number(value).toFixed(2));
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function isPreviousDay(dateValue) {
  const openedAt = new Date(dateValue);
  const openedDay = new Date(openedAt);
  openedDay.setHours(0, 0, 0, 0);
  return openedDay.getTime() < startOfToday().getTime();
}

function normalizeAmount(value, fieldName) {
  const normalized = Number(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(normalized) || normalized < 0) {
    throw validationError(`${fieldName} invalido.`);
  }

  return roundCurrency(normalized);
}

function normalizeNotes(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

async function buildSessionSummary(session) {
  if (!session) return null;

  const { totalIn, totalOut } = await repository.sumSessionEntries(session.idCashSession);
  const openingBalance = Number(session.openingBalance || 0);
  const expectedBalance = roundCurrency(openingBalance + totalIn - totalOut);
  return {
    id: session.idCashSession,
    status: session.status,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    openingBalance,
    totalIn: roundCurrency(totalIn),
    totalOut: roundCurrency(totalOut),
    expectedBalance,
    countedBalance:
      session.countedBalance === null || session.countedBalance === undefined
        ? null
        : Number(session.countedBalance),
    differenceAmount:
      session.differenceAmount === null || session.differenceAmount === undefined
        ? null
        : Number(session.differenceAmount),
    notes: session.notes || null,
    openedByUserId: session.openedByUserId || null,
    closedByUserId: session.closedByUserId || null,
    pendingPreviousDay: isPreviousDay(session.openedAt),
  };
}

async function getStoreSessionStatus() {
  const openSession = await repository.findOpenStoreSession();
  const currentSession = await buildSessionSummary(openSession);
  const lastClosedSession = currentSession
    ? null
    : await buildSessionSummary(await repository.findLatestClosedSession());

  return {
    currentSession,
    lastClosedSession,
    hasOpenSession: Boolean(currentSession),
    pendingPreviousDay: Boolean(currentSession?.pendingPreviousDay),
  };
}

async function openStoreSession(body = {}, user = {}) {
  const existing = await repository.findOpenStoreSession();
  if (existing) {
    throw conflictError("Ja existe um caixa da loja aberto.");
  }

  const lastClosedSession = await repository.findLatestClosedSession();
  const defaultOpeningBalance = lastClosedSession
    ? Number(lastClosedSession.expectedBalance || lastClosedSession.countedBalance || 0)
    : 0;

  const created = await repository.createSession({
    status: "OPEN",
    openedAt: new Date(),
    openingBalance:
      body.openingBalance === null ||
      body.openingBalance === undefined ||
      body.openingBalance === ""
        ? roundCurrency(defaultOpeningBalance)
        : normalizeAmount(body.openingBalance, "Saldo inicial"),
    notes: normalizeNotes(body.notes),
    openedByUserId: user.id || null,
  });

  return {
    message: "Caixa da loja aberto com sucesso.",
    session: await buildSessionSummary(created),
  };
}

async function closeCurrentStoreSession(body = {}, user = {}) {
  const session = await repository.findOpenStoreSession();
  if (!session) {
    throw notFoundError("Nenhum caixa da loja aberto.");
  }

  const summary = await buildSessionSummary(session);
  const countedBalance =
    body.countedBalance === null ||
    body.countedBalance === undefined ||
    body.countedBalance === ""
      ? summary.expectedBalance
      : normalizeAmount(body.countedBalance, "Saldo contado");
  const differenceAmount = roundCurrency(countedBalance - summary.expectedBalance);

  await repository.updateSession(session, {
    status: "CLOSED",
    closedAt: new Date(),
    expectedBalance: summary.expectedBalance,
    countedBalance,
    differenceAmount,
    notes: normalizeNotes(body.notes) ?? session.notes,
    closedByUserId: user.id || null,
  });

  return {
    message: "Caixa da loja fechado com sucesso.",
    session: await buildSessionSummary(session),
  };
}

async function rolloverStoreSession(body = {}, user = {}) {
  return sequelize.transaction(async (transaction) => {
    const session = await repository.findOpenStoreSession(transaction);
    if (!session) {
      throw notFoundError("Nenhum caixa da loja aberto.");
    }

    if (!isPreviousDay(session.openedAt)) {
      throw conflictError(
        "Nao existe caixa pendente de dia anterior para encerrar.",
      );
    }

    const summary = await buildSessionSummary(session);
    const carriedBalance = summary.expectedBalance;

    await repository.updateSession(
      session,
      {
        status: "CLOSED",
        closedAt: new Date(),
        expectedBalance: summary.expectedBalance,
        countedBalance: carriedBalance,
        differenceAmount: 0,
        notes: normalizeNotes(body.notes) ?? session.notes,
        closedByUserId: user.id || null,
      },
      transaction,
    );

    const newSession = await repository.createSession(
      {
        status: "OPEN",
        openedAt: new Date(),
        openingBalance: carriedBalance,
        notes: normalizeNotes(body.notes) ?? session.notes ?? null,
        openedByUserId: user.id || null,
      },
      transaction,
    );

    return {
      message: "Caixa anterior encerrado e caixa do dia aberto com sucesso.",
      previousSession: await buildSessionSummary(session),
      currentSession: await buildSessionSummary(newSession),
    };
  });
}

module.exports = {
  getStoreSessionStatus,
  openStoreSession,
  closeCurrentStoreSession,
  rolloverStoreSession,
};
