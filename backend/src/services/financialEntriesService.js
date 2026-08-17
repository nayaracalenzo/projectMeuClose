const { conflictError, validationError } = require("../errors/AppError");
const cashRepository = require("../repositories/cashRepository");
const bankRepository = require("../repositories/bankRepository");
const cashSessionsRepository = require("../repositories/cashSessionsRepository");
const financialCategoriesRepository = require("../repositories/financialCategoriesRepository");
const { normalizeDateToLocalMidnight } = require("../utils/normalizeDate");

function normalizeLegacyCategoryText(value) {
  return String(value || "").trim().toUpperCase();
}

function createFinancialCategoryError(message) {
  return validationError(message, {
    name: "FinancialCategoryValidationError",
    code: "FINANCIAL_CATEGORY_VALIDATION_ERROR",
  });
}

async function resolveFinancialCategoryId(payload = {}) {
  const explicitId = Number(payload.financialCategoryId);

  if (Number.isInteger(explicitId) && explicitId > 0) {
    return explicitId;
  }

  if (
    payload.sourceType === "SALE_RECEIPT" ||
    payload.sourceType === "RECEIVABLE_RECEIPT"
  ) {
    const salesRevenueCategory =
      (await financialCategoriesRepository.getCategoryByDescription("VENDA")) 

    if (!salesRevenueCategory?.idFinancialCategory) {
      throw createFinancialCategoryError("Categoria financeira de receita de vendas nao encontrada.");
    }

    return salesRevenueCategory.idFinancialCategory;
  }

  const rawCategory = String(payload.category || "").trim();

  if (!rawCategory) {
    throw createFinancialCategoryError("Categoria financeira e obrigatoria.");
  }

  const normalized = normalizeLegacyCategoryText(rawCategory);
  const aliasMap = {
    VENDA: "VENDA",
    RECEBIMENTO: "VENDA",
    TRANSFERENCIA: "TRANSFERENCIAS ENTRE CAIXA E BANCO",
  };

  const category = await financialCategoriesRepository.getCategoryByDescription(
    aliasMap[normalized] || rawCategory,
  );

  if (!category?.idFinancialCategory) {
    throw createFinancialCategoryError("Categoria financeira invalida.");
  }

  return category.idFinancialCategory;
}

async function normalizeFinancialEntryPayload(payload = {}) {
  const financialCategoryId = await resolveFinancialCategoryId(payload);
  const financialCategory = await financialCategoriesRepository.getCategoryById(
    financialCategoryId,
  );

  return {
    scope: payload.scope || "LOJA",
    movementType: payload.movementType,
    category: payload.category || financialCategory?.description,
    financialCategoryId,
    description: payload.description || "Lancamento financeiro",
    amount: Number(payload.amount),
    occurredAt: payload.occurredAt || new Date(),
    sourceType: payload.sourceType || "MANUAL",
    saleId: payload.saleId || null,
    paymentReceiptId: payload.paymentReceiptId || null,
    payablePaymentId: payload.payablePaymentId || null,
    paymentTypeId: payload.paymentTypeId || null,
    referenceCode: payload.referenceCode || null,
    transferKey: payload.transferKey || null,
    reversalOfCashEntryId: payload.reversalOfCashEntryId || null,
    reversalOfBankEntryId: payload.reversalOfBankEntryId || null,
  };
}

function normalizeReferenceDay(referenceDateValue = new Date()) {
  if (referenceDateValue instanceof Date && !Number.isNaN(referenceDateValue.getTime())) {
    const normalizedDate = new Date(referenceDateValue);
    normalizedDate.setHours(0, 0, 0, 0);
    return normalizedDate;
  }

  const normalizedFromString = normalizeDateToLocalMidnight(referenceDateValue);

  if (normalizedFromString) {
    return normalizedFromString;
  }

  const fallbackDate = new Date();
  fallbackDate.setHours(0, 0, 0, 0);
  return fallbackDate;
}

function isPreviousDay(dateValue, referenceDateValue = new Date()) {
  if (!dateValue) return false;

  const openedAt = new Date(dateValue);
  const openedDay = new Date(openedAt);
  openedDay.setHours(0, 0, 0, 0);

  const referenceDay = normalizeReferenceDay(referenceDateValue);

  return openedDay.getTime() < referenceDay.getTime();
}

async function createCashEntry(payload, transaction) {
  const normalizedPayload = await normalizeFinancialEntryPayload(payload);
  let cashSessionId = null;

  if (normalizedPayload.scope === "LOJA") {
    const openSession = await cashSessionsRepository.findOpenStoreSession(transaction);

    if (!openSession) {
      throw conflictError("Abra o caixa da loja antes de registrar lancamentos em dinheiro.");
    }

    if (isPreviousDay(openSession.openedAt, normalizedPayload.occurredAt)) {
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
      ...(await normalizeFinancialEntryPayload(payload)),
      accountLabel: payload.accountLabel || "Banco da Loja",
    },
    transaction,
  );
}

module.exports = {
  createCashEntry,
  createBankEntry,
};
