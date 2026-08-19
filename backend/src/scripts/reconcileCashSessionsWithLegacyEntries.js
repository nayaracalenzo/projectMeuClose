require("dotenv").config();
const { CashEntries, CashSessions, sequelize } = require("../models");

function roundCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

function toNumber(value) {
  return Number(value || 0);
}

function getSignedAmount(entry) {
  const amount = toNumber(entry.amount);
  return entry.movementType === "IN" ? amount : -amount;
}

function parseArgs() {
  return {
    apply: process.argv.includes("--apply"),
  };
}

async function loadStoreSessions(transaction) {
  return CashSessions.findAll({
    order: [["openedAt", "ASC"], ["idCashSession", "ASC"]],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
}

async function loadStoreEntries(transaction) {
  return CashEntries.findAll({
    where: {
      scope: "LOJA",
    },
    order: [["occurredAt", "ASC"], ["idCashEntry", "ASC"]],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
}

function findTargetSessionIndex(sessions, occurredAt) {
  const targetTime = new Date(occurredAt).getTime();

  for (let index = 0; index < sessions.length; index += 1) {
    const current = sessions[index];
    const next = sessions[index + 1] || null;
    const currentTime = new Date(current.openedAt).getTime();
    const nextTime = next ? new Date(next.openedAt).getTime() : Number.POSITIVE_INFINITY;

    if (targetTime >= currentTime && targetTime < nextTime) {
      return index;
    }
  }

  return -1;
}

function buildReconciliationPlan(sessions, entries) {
  if (!sessions.length) {
    return {
      preSessionBalance: 0,
      ledgerBalance: roundCurrency(entries.reduce((acc, entry) => acc + getSignedAmount(entry), 0)),
      orphanEntriesBeforeFirstSession: [],
      orphanEntriesAssigned: [],
      sessionPlans: [],
      sessionsToUpdate: [],
      entryAssignments: [],
      finalExpectedBalance: 0,
    };
  }

  const firstSession = sessions[0];
  const firstSessionOpenedAt = new Date(firstSession.openedAt).getTime();
  const preSessionEntries = [];
  const assignableOrphans = [];
  const entriesBySessionId = new Map(sessions.map((session) => [session.idCashSession, []]));

  for (const entry of entries) {
    if (entry.cashSessionId && entriesBySessionId.has(entry.cashSessionId)) {
      entriesBySessionId.get(entry.cashSessionId).push(entry);
      continue;
    }

    const occurredAtTime = new Date(entry.occurredAt).getTime();
    if (occurredAtTime < firstSessionOpenedAt) {
      preSessionEntries.push(entry);
      continue;
    }

    assignableOrphans.push(entry);
  }

  const orphanAssignments = [];

  for (const entry of assignableOrphans) {
    const targetSessionIndex = findTargetSessionIndex(sessions, entry.occurredAt);

    if (targetSessionIndex < 0) {
      continue;
    }

    const targetSession = sessions[targetSessionIndex];
    entriesBySessionId.get(targetSession.idCashSession).push(entry);
    orphanAssignments.push({
      entryId: entry.idCashEntry,
      targetSessionId: targetSession.idCashSession,
      occurredAt: entry.occurredAt,
      description: entry.description,
      amount: roundCurrency(entry.amount),
      movementType: entry.movementType,
    });
  }

  const preSessionBalance = roundCurrency(
    preSessionEntries.reduce((acc, entry) => acc + getSignedAmount(entry), 0),
  );
  const ledgerBalance = roundCurrency(entries.reduce((acc, entry) => acc + getSignedAmount(entry), 0));

  let carriedBalance = preSessionBalance;
  const sessionPlans = [];
  const sessionsToUpdate = [];

  for (const session of sessions) {
    const sessionEntries = entriesBySessionId.get(session.idCashSession) || [];
    const sessionNet = roundCurrency(
      sessionEntries.reduce((acc, entry) => acc + getSignedAmount(entry), 0),
    );
    const recomputedOpeningBalance = roundCurrency(carriedBalance);
    const recomputedExpectedBalance = roundCurrency(recomputedOpeningBalance + sessionNet);
    const currentExpectedBalance =
      session.expectedBalance === null || session.expectedBalance === undefined
        ? null
        : roundCurrency(session.expectedBalance);
    const currentCountedBalance =
      session.countedBalance === null || session.countedBalance === undefined
        ? null
        : roundCurrency(session.countedBalance);
    const currentDifferenceAmount =
      session.differenceAmount === null || session.differenceAmount === undefined
        ? null
        : roundCurrency(session.differenceAmount);

    let recomputedCountedBalance = currentCountedBalance;
    let recomputedDifferenceAmount = currentDifferenceAmount;

    if (session.status === "CLOSED") {
      const closesWithoutManualDifference =
        currentDifferenceAmount === null ||
        Math.abs(currentDifferenceAmount) < 0.005 ||
        (currentCountedBalance !== null &&
          currentExpectedBalance !== null &&
          Math.abs(currentCountedBalance - currentExpectedBalance) < 0.005);

      if (closesWithoutManualDifference) {
        recomputedCountedBalance = recomputedExpectedBalance;
        recomputedDifferenceAmount = 0;
      } else if (currentCountedBalance !== null) {
        recomputedDifferenceAmount = roundCurrency(
          currentCountedBalance - recomputedExpectedBalance,
        );
      }
    } else {
      recomputedCountedBalance = null;
      recomputedDifferenceAmount = null;
    }

    const sessionPlan = {
      sessionId: session.idCashSession,
      status: session.status,
      openedAt: session.openedAt,
      currentOpeningBalance: roundCurrency(session.openingBalance),
      recomputedOpeningBalance,
      currentExpectedBalance,
      recomputedExpectedBalance,
      currentCountedBalance,
      recomputedCountedBalance,
      currentDifferenceAmount,
      recomputedDifferenceAmount,
      entriesCount: sessionEntries.length,
      sessionNet,
      needsUpdate:
        roundCurrency(session.openingBalance) !== recomputedOpeningBalance ||
        currentExpectedBalance !==
          (session.status === "CLOSED" ? recomputedExpectedBalance : currentExpectedBalance) ||
        currentCountedBalance !== recomputedCountedBalance ||
        currentDifferenceAmount !== recomputedDifferenceAmount,
    };

    sessionPlans.push(sessionPlan);

    if (sessionPlan.needsUpdate) {
      sessionsToUpdate.push({
        sessionId: session.idCashSession,
        openingBalance: recomputedOpeningBalance,
        expectedBalance: session.status === "CLOSED" ? recomputedExpectedBalance : null,
        countedBalance: recomputedCountedBalance,
        differenceAmount: recomputedDifferenceAmount,
      });
    }

    carriedBalance = recomputedExpectedBalance;
  }

  return {
    preSessionBalance,
    ledgerBalance,
    orphanEntriesBeforeFirstSession: preSessionEntries,
    orphanEntriesAssigned: orphanAssignments,
    sessionPlans,
    sessionsToUpdate,
    entryAssignments: orphanAssignments,
    finalExpectedBalance: roundCurrency(carriedBalance),
  };
}

function logPlan(plan) {
  console.log(`Saldo legado antes da primeira sessao: ${plan.preSessionBalance.toFixed(2)}`);
  console.log(`Saldo total do extrato da LOJA: ${plan.ledgerBalance.toFixed(2)}`);
  console.log(
    `Lancamentos sem sessao antes da primeira sessao: ${plan.orphanEntriesBeforeFirstSession.length}`,
  );
  console.log(`Lancamentos sem sessao que serao vinculados: ${plan.orphanEntriesAssigned.length}`);
  console.log(`Sessoes com ajuste de saldo: ${plan.sessionsToUpdate.length}`);
  console.log(`Saldo final esperado na cadeia das sessoes: ${plan.finalExpectedBalance.toFixed(2)}`);

  const sessionMismatches = plan.sessionPlans.filter((item) => item.needsUpdate);
  if (sessionMismatches.length) {
    console.log("\nSessoes com divergencia:");
    for (const item of sessionMismatches.slice(0, 20)) {
      console.log(
        `- Sessao ${item.sessionId} (${item.status}) | abertura ${item.currentOpeningBalance.toFixed(
          2,
        )} -> ${item.recomputedOpeningBalance.toFixed(2)} | esperado ${
          item.currentExpectedBalance === null ? "-" : item.currentExpectedBalance.toFixed(2)
        } -> ${item.recomputedExpectedBalance.toFixed(2)} | lancamentos ${item.entriesCount} | saldo da sessao ${item.sessionNet.toFixed(2)}`,
      );
    }
  }

  if (plan.orphanEntriesAssigned.length) {
    console.log("\nPrimeiros lancamentos sem sessao que serao vinculados:");
    for (const item of plan.orphanEntriesAssigned.slice(0, 20)) {
      console.log(
        `- Lancamento ${item.entryId} -> sessao ${item.targetSessionId} | ${item.occurredAt} | ${item.movementType} ${item.amount.toFixed(2)} | ${item.description}`,
      );
    }
  }
}

async function applyPlan(plan, transaction) {
  const assignmentsBySession = new Map();

  for (const assignment of plan.entryAssignments) {
    if (!assignmentsBySession.has(assignment.targetSessionId)) {
      assignmentsBySession.set(assignment.targetSessionId, []);
    }

    assignmentsBySession.get(assignment.targetSessionId).push(assignment.entryId);
  }

  for (const [sessionId, entryIds] of assignmentsBySession.entries()) {
    await CashEntries.update(
      {
        cashSessionId: sessionId,
      },
      {
        where: {
          idCashEntry: entryIds,
        },
        transaction,
      },
    );
  }

  for (const sessionUpdate of plan.sessionsToUpdate) {
    await CashSessions.update(
      {
        openingBalance: sessionUpdate.openingBalance,
        expectedBalance: sessionUpdate.expectedBalance,
        countedBalance: sessionUpdate.countedBalance,
        differenceAmount: sessionUpdate.differenceAmount,
      },
      {
        where: {
          idCashSession: sessionUpdate.sessionId,
        },
        transaction,
      },
    );
  }
}

async function main() {
  const { apply } = parseArgs();

  try {
    const sessions = await loadStoreSessions();
    const entries = await loadStoreEntries();
    const plan = buildReconciliationPlan(sessions, entries);

    logPlan(plan);

    if (!apply) {
      console.log("\nModo simulacao: nada foi alterado. Rode com --apply para gravar.");
      return;
    }

    await sequelize.transaction(async (transaction) => {
      await applyPlan(plan, transaction);
    });

    console.log("\nReconciliacao aplicada com sucesso.");
  } catch (error) {
    console.error("Erro ao reconciliar sessoes de caixa:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  void main();
}
