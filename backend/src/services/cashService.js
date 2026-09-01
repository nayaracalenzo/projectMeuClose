const { sequelize } = require("../models");
const { notFoundError, validationError } = require("../errors/AppError");
const repository = require("../repositories/cashRepository");
const bankRepository = require("../repositories/bankRepository");
const auditsRepository = require("../repositories/auditsRepository");
const financialCategoriesRepository = require("../repositories/financialCategoriesRepository");
const { createCashEntry, createBankEntry } = require("./financialEntriesService");
const { normalizeShortOrIsoDateToIso } = require("../utils/normalizeDate");

function createCashValidationError(message, statusCode = 400) {
  const error = validationError(message, {
    name: "CashValidationError",
    code: "CASH_VALIDATION_ERROR",
  });
  error.statusCode = statusCode;
  return error;
}

function normalizeDate(value, fieldName, options = {}) {
  if (!value) return null;

  const normalized = normalizeShortOrIsoDateToIso(value);

  if (!normalized) {
    throw createCashValidationError(`${fieldName} invalida.`);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    options.endOfDay ? 23 : 0,
    options.endOfDay ? 59 : 0,
    options.endOfDay ? 59 : 0,
    options.endOfDay ? 999 : 0,
  );
}

function isFutureDate(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date.getTime() > today.getTime();
}

function normalizeAmount(value, fieldName) {
  const normalized = Number(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw createCashValidationError(`${fieldName} invalido.`);
  }

  return Number(normalized.toFixed(2));
}

function normalizeMovementType(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized !== "IN" && normalized !== "OUT") {
    throw createCashValidationError("Tipo de movimentacao invalido.");
  }

  return normalized;
}

function normalizeDescription(value, fieldName = "Descricao") {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw createCashValidationError(`${fieldName} obrigatoria.`);
  }

  return normalized;
}

function normalizeReferenceCode(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeUserId(user) {
  const normalized = Number(user?.id ?? user?.idUser);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    return null;
  }

  return normalized;
}

function formatInstallmentLabel(installmentNumber, totalInstallments) {
  const current = Number(installmentNumber) || 0;
  const total = Number(totalInstallments) || 0;

  if (current <= 0 || total <= 0) {
    return null;
  }

  return `${current}/${total}`;
}

function resolveEntryInstallmentLabel(item) {
  const installmentLabel = formatInstallmentLabel(
    item.get?.("installmentNumber") || item.installmentNumber || null,
    item.get?.("totalInstallments") || item.totalInstallments || null,
  );

  if (installmentLabel) {
    return installmentLabel;
  }

  return "-";
}

function extractLegacyPaymentTypeName(description) {
  const normalized = String(description || "").trim();

  if (!normalized) {
    return null;
  }

  const match = /\bvia\s+(.+)$/i.exec(normalized);
  return match?.[1]?.trim() || null;
}

function resolveEntryPaymentTypeName(item) {
  return item.PaymentType?.desc || extractLegacyPaymentTypeName(item.description);
}

function resolveDisplayDescription(description, paymentTypeName) {
  const normalizedDescription = String(description || "").trim();
  const normalizedPaymentTypeName = String(paymentTypeName || "").trim();

  if (!normalizedDescription || !normalizedPaymentTypeName) {
    return normalizedDescription;
  }

  return normalizedDescription.replace(
    new RegExp(`\\s+via\\s+${normalizedPaymentTypeName}$`, "i"),
    "",
  );
}

function buildAuditHistory(kind, scope, entry, occurredAt) {
  const amount = Number(entry.amount || 0).toFixed(2);
  const dateLabel = new Intl.DateTimeFormat("pt-BR").format(new Date(occurredAt));

  return `${kind} de CAIXA do lancamento ${entry.idCashEntry} em ${dateLabel}, valor ${amount}, descricao ${entry.description}.`;
}

function isCancelledSaleEntry(entry) {
  return entry?.sourceType === "SALE_RECEIPT" && entry?.Sale?.status === "CANCELLED";
}

function hasEntryReversal(entry) {
  return (
    Boolean(entry?.reversalOfCashEntryId) ||
    Boolean(entry?.get?.("hasReversal")) ||
    Boolean(entry?.hasReversal)
  );
}

function isReversalDescription(entry) {
  return String(entry?.description || "").trim().toUpperCase().startsWith("ESTORNO - ");
}

function canReverseEntry(entry) {
  if (!entry || hasEntryReversal(entry) || isReversalDescription(entry)) {
    return false;
  }

  if (entry.sourceType === "MANUAL") {
    return true;
  }

  return isCancelledSaleEntry(entry);
}

async function getRequiredFinancialCategoryId(rawFinancialCategoryId) {
  const normalized = Number(rawFinancialCategoryId);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw createCashValidationError("Categoria financeira invalida.");
  }

  const category = await financialCategoriesRepository.getCategoryById(normalized);

  if (!category) {
    throw createCashValidationError("Categoria financeira invalida.");
  }

  return normalized;
}

async function listEntries(query = {}) {
  const scope = query.scope ? String(query.scope).trim() : undefined;
  const search = query.search ? String(query.search).trim() : undefined;
  const financialCategoryId = query.financialCategoryId
    ? Number(query.financialCategoryId)
    : undefined;
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
  const startDate = normalizeDate(query.startDate, "Data inicial");
  const endDate = normalizeDate(query.endDate, "Data final", { endOfDay: true });

  const result = await repository.listEntries({
    scope,
    search,
    financialCategoryId,
    page,
    pageSize,
    startDate,
    endDate,
  });

  const summary = await repository.summarizeEntries({
    scope,
    search,
    financialCategoryId,
    startDate,
    endDate,
  });

  const previousBalance = startDate
    ? await repository.getBalanceBeforeDate({
        scope,
        beforeDate: startDate,
      })
    : 0;

  return {
    items: result.rows.map((item) => {
      const paymentTypeName = resolveEntryPaymentTypeName(item);

      return {
        id: item.idCashEntry,
        date: item.occurredAt,
        scope: item.scope,
        accountLabel: "Caixa",
        parcela: resolveEntryInstallmentLabel(item),
        description: resolveDisplayDescription(item.description, paymentTypeName),
        paymentTypeName,
        category: item.FinancialCategory?.description || item.category || "DIVERSOS",
        financialCategoryId:
          item.financialCategoryId || item.FinancialCategory?.idFinancialCategory || null,
        financialCategoryDescription:
          item.FinancialCategory?.description || item.category || "DIVERSOS",
        movementType: item.movementType,
        amount: Number(item.amount),
        amountIn: item.movementType === "IN" ? Number(item.amount) : 0,
        amountOut: item.movementType === "OUT" ? Number(item.amount) : 0,
        balance: Number(item.get("runningBalance") || 0),
        referenceCode: item.referenceCode,
        sourceType: item.sourceType,
        transferKey: item.transferKey || null,
        reversalOfCashEntryId: item.reversalOfCashEntryId || null,
        hasReversal: Boolean(item.get?.("hasReversal") || item.hasReversal),
        canReverse: canReverseEntry(item),
      };
    }),
    total: Number(result.count || 0),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(result.count || 0) / pageSize)),
    summary: {
      totalIn: Number(Number(summary.totalIn || 0).toFixed(2)),
      totalOut: Number(Number(summary.totalOut || 0).toFixed(2)),
      balance: Number((Number(summary.totalIn || 0) - Number(summary.totalOut || 0)).toFixed(2)),
      previousBalance: Number(Number(previousBalance || 0).toFixed(2)),
    },
  };
}

async function listAccountOptions() {
  return [
    {
      label: "Caixa",
      value: "Caixa",
    },
  ];
}

async function createManualEntry(body = {}) {
  const scope = "LOJA";
  const movementType = normalizeMovementType(body.movementType);
  const financialCategoryId = await getRequiredFinancialCategoryId(body.financialCategoryId);
  const description = normalizeDescription(body.description);
  const amount = normalizeAmount(body.amount, "Valor");
  const occurredAt = normalizeDate(body.occurredAt, "Data") || new Date();
  const referenceCode = normalizeReferenceCode(body.referenceCode);

  if (isFutureDate(occurredAt)) {
    throw createCashValidationError("A data do lancamento nao pode ser futura.");
  }

  const created = await createCashEntry({
    scope,
    movementType,
    financialCategoryId,
    description,
    amount,
    occurredAt,
    sourceType: "MANUAL",
    referenceCode,
  });

  return {
    id: created.idCashEntry,
    message: "Lancamento manual criado com sucesso.",
  };
}

async function reverseEntry(idCashEntry, user, body = {}) {
  const normalizedId = Number(idCashEntry);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw createCashValidationError("Lancamento de caixa invalido.");
  }

  const reason = normalizeDescription(body.reason, "Motivo");
  const userId = normalizeUserId(user);
  const occurredAt = new Date();

  return sequelize.transaction(async (transaction) => {
    const entry = await repository.getEntryById(normalizedId, transaction);

    if (!entry) {
      throw notFoundError("Lancamento de caixa nao encontrado.");
    }

    if (!canReverseEntry(entry)) {
      throw createCashValidationError(
        "Somente lancamentos manuais, transferencias manuais ou vendas canceladas podem ser extornados uma unica vez.",
      );
    }

    const existingReversal = await repository.findReversalByOriginId(normalizedId, transaction);

    if (existingReversal) {
      throw createCashValidationError("Este lancamento ja foi extornado.");
    }

    const categoryDescription =
      entry.FinancialCategory?.description || entry.category || "DIVERSOS";
    const reversalDescription = `ESTORNO - ${entry.description}`;

    const reversedCashEntry = await createCashEntry(
      {
        scope: entry.scope,
        movementType: entry.movementType === "IN" ? "OUT" : "IN",
        financialCategoryId: entry.financialCategoryId || null,
        category: categoryDescription,
        description: reversalDescription,
        amount: Number(entry.amount),
        occurredAt,
        sourceType: "MANUAL",
        referenceCode: entry.referenceCode || null,
        transferKey: entry.transferKey || null,
        reversalOfCashEntryId: entry.idCashEntry,
      },
      transaction,
    );

    await auditsRepository.createAudit(
      {
        auditTypeId: 3,
        userId,
        occurredAt,
        history: buildAuditHistory("EXTORNO", entry.scope, entry, occurredAt),
        reason,
      },
      transaction,
    );

    if (entry.transferKey) {
      const relatedBankEntry = await bankRepository.findByTransferKey(entry.transferKey, transaction);

      if (relatedBankEntry) {
        const existingBankReversal = await bankRepository.findReversalByOriginId(
          relatedBankEntry.idBankEntry,
          transaction,
        );

        if (!existingBankReversal) {
          await createBankEntry(
            {
              scope: relatedBankEntry.scope,
              movementType: relatedBankEntry.movementType === "IN" ? "OUT" : "IN",
              financialCategoryId: relatedBankEntry.financialCategoryId || null,
              category: relatedBankEntry.category || categoryDescription,
              description: reversalDescription,
              accountLabel: relatedBankEntry.accountLabel || "Banco da Loja",
              amount: Number(relatedBankEntry.amount),
              occurredAt,
              sourceType: "MANUAL",
              referenceCode: relatedBankEntry.referenceCode || null,
              transferKey: relatedBankEntry.transferKey || null,
              reversalOfBankEntryId: relatedBankEntry.idBankEntry,
            },
            transaction,
          );

          await auditsRepository.createAudit(
            {
              auditTypeId: 4,
              userId,
              occurredAt,
              history: `EXTORNO de ${
                relatedBankEntry.scope === "LOJA" ? "BANCO" : "BANCO PESSOAL"
              } do lancamento ${relatedBankEntry.idBankEntry} em ${new Intl.DateTimeFormat(
                "pt-BR",
              ).format(occurredAt)}, valor ${Number(relatedBankEntry.amount || 0).toFixed(
                2,
              )}, descricao ${relatedBankEntry.description}.`,
              reason,
            },
            transaction,
          );
        }
      }
    }

    return {
      id: reversedCashEntry.idCashEntry,
      message: "Extorno registrado com sucesso.",
    };
  });
}

module.exports = {
  listEntries,
  listAccountOptions,
  createManualEntry,
  reverseEntry,
};
