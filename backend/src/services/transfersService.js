const { sequelize } = require("../models");
const { validationError } = require("../errors/AppError");
const financialCategoriesRepository = require("../repositories/financialCategoriesRepository");
const { createBankEntry, createCashEntry } = require("./financialEntriesService");

function roundCurrency(value) {
  return Number(Number(value).toFixed(2));
}

function normalizeAmount(value) {
  const normalized = Number(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw validationError("Valor da transferencia invalido.");
  }

  return roundCurrency(normalized);
}

function normalizeDate(value) {
  if (!value) {
    return new Date();
  }

  const raw = String(value).trim();
  const base = raw.includes("T") ? raw.split("T")[0] : raw;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);

  if (!match) {
    throw validationError("Data da transferencia invalida.");
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);

  if (Number.isNaN(date.getTime())) {
    throw validationError("Data da transferencia invalida.");
  }

  return date;
}

function normalizeDescription(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw validationError("Descricao da transferencia e obrigatoria.");
  }

  return normalized;
}

function normalizeReferenceCode(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeScope(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized !== "LOJA" && normalized !== "PESSOAL") {
    throw validationError("Escopo da transferencia invalido.");
  }

  return normalized;
}

function normalizeAccountLabel(scope, value) {
  if (scope === "LOJA") {
    return "Banco da Loja";
  }

  const normalized = String(value || "").trim();

  if (!normalized) {
    throw validationError("Banco de destino obrigatorio.");
  }

  return normalized;
}

function buildTransferKey(scope) {
  return `TRF-${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function getRequiredFinancialCategoryId(rawFinancialCategoryId) {
  const normalized = Number(rawFinancialCategoryId);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw validationError("Categoria financeira invalida.");
  }

  const category = await financialCategoriesRepository.getCategoryById(normalized);

  if (!category) {
    throw validationError("Categoria financeira invalida.");
  }

  return normalized;
}

async function transferStoreCashToBank(body = {}) {
  const scope = normalizeScope(body.scope || "LOJA");
  const amount = normalizeAmount(body.amount);
  const occurredAt = normalizeDate(body.occurredAt);
  const description = normalizeDescription(body.description);
  const referenceCode = normalizeReferenceCode(body.referenceCode);
  const financialCategoryId = await getRequiredFinancialCategoryId(body.financialCategoryId);
  const accountLabel = normalizeAccountLabel(scope, body.accountLabel);
  const transferKey = buildTransferKey(scope);

  return sequelize.transaction(async (transaction) => {
    const cashEntry = await createCashEntry(
      {
        scope,
        movementType: "OUT",
        financialCategoryId,
        category: "TRANSFERENCIA",
        description,
        amount,
        occurredAt,
        sourceType: "MANUAL",
        paymentTypeId: null,
        referenceCode,
        transferKey,
      },
      transaction,
    );

    const bankEntry = await createBankEntry(
      {
        scope,
        movementType: "IN",
        financialCategoryId,
        category: "TRANSFERENCIA",
        description,
        accountLabel,
        amount,
        occurredAt,
        sourceType: "MANUAL",
        paymentTypeId: null,
        referenceCode,
        transferKey,
      },
      transaction,
    );

    return {
      message: "Transferencia do caixa para o banco registrada com sucesso.",
      cashEntryId: cashEntry.idCashEntry,
      bankEntryId: bankEntry.idBankEntry,
    };
  });
}

module.exports = {
  transferStoreCashToBank,
};
