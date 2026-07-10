const { conflictError } = require("../errors/AppError");
const cashRepository = require("../repositories/cashRepository");
const bankRepository = require("../repositories/bankRepository");
const cashSessionsRepository = require("../repositories/cashSessionsRepository");

function normalizeFinancialEntryPayload(payload = {}) {
  return {
    scope: payload.scope || "LOJA",
    movementType: payload.movementType,
    category: payload.category || "GERAL",
    description: payload.description || "Lançamento financeiro",
    amount: Number(payload.amount),
    occurredAt: payload.occurredAt || new Date(),
    sourceType: payload.sourceType || "MANUAL",
    saleId: payload.saleId || null,
    paymentReceiptId: payload.paymentReceiptId || null,
    payablePaymentId: payload.payablePaymentId || null,
    paymentTypeId: payload.paymentTypeId || null,
    referenceCode: payload.referenceCode || null,
  };
}

function isPreviousDay(dateValue) {
  if (!dateValue) return false;

  const openedAt = new Date(dateValue);
  const openedDay = new Date(openedAt);
  openedDay.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return openedDay.getTime() < today.getTime();
}

async function createCashEntry(payload, transaction) {
  const normalizedPayload = normalizeFinancialEntryPayload(payload);
  let cashSessionId = null;

  if (normalizedPayload.scope === "LOJA") {
    const openSession = await cashSessionsRepository.findOpenStoreSession(transaction);

    if (!openSession) {
      throw conflictError("Abra o caixa da loja antes de registrar lancamentos em dinheiro.");
    }

    if (isPreviousDay(openSession.openedAt)) {
      throw conflictError(
        "Existe um caixa da loja aberto de dia anterior. Feche o caixa antes de continuar.",
      );
    }

    cashSessionId = openSession.idCashSession;
  }

  return cashRepository.createEntry(
    {
      ...normalizedPayload,
      cashSessionId,
    },
    transaction,
  );
}

async function createBankEntry(payload, transaction) {
  return bankRepository.createEntry(
    {
      ...normalizeFinancialEntryPayload(payload),
      accountLabel: payload.accountLabel || "Banco da Loja",
    },
    transaction,
  );
}

module.exports = {
  createCashEntry,
  createBankEntry,
};
