const { sequelize } = require("../models");
const { notFoundError, validationError } = require("../errors/AppError");
const repository = require("../repositories/bankRepository");
const cashRepository = require("../repositories/cashRepository");
const auditsRepository = require("../repositories/auditsRepository");
const financialCategoriesRepository = require("../repositories/financialCategoriesRepository");
const { createBankEntry, createCashEntry } = require("./financialEntriesService");

function createBankValidationError(message, statusCode = 400) {
  const error = validationError(message, {
    name: "BankValidationError",
    code: "BANK_VALIDATION_ERROR",
  });
  error.statusCode = statusCode;
  return error;
}

function normalizeDate(value, fieldName, options = {}) {
  if (!value) return null;

  const base = String(value).trim().split("T")[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);

  if (!match) {
    throw createBankValidationError(`${fieldName} invalida.`);
  }

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

function normalizeAmount(value, fieldName) {
  const normalized = Number(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw createBankValidationError(`${fieldName} invalido.`);
  }

  return Number(normalized.toFixed(2));
}

function normalizeMovementType(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized !== "IN" && normalized !== "OUT") {
    throw createBankValidationError("Tipo de movimentacao invalido.");
  }

  return normalized;
}

function normalizeDescription(value, fieldName = "Descricao") {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw createBankValidationError(`${fieldName} obrigatoria.`);
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

function buildAuditHistory(kind, scope, entry, occurredAt) {
  const amount = Number(entry.amount || 0).toFixed(2);
  const dateLabel = new Intl.DateTimeFormat("pt-BR").format(new Date(occurredAt));

  return `${kind} de BANCO do lancamento ${entry.idBankEntry} em ${dateLabel}, valor ${amount}, descricao ${entry.description}.`;
}

function isCancelledSaleEntry(entry) {
  return entry?.sourceType === "SALE_RECEIPT" && entry?.Sale?.status === "CANCELLED";
}

function hasEntryReversal(entry) {
  return (
    Boolean(entry?.reversalOfBankEntryId) ||
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
    throw createBankValidationError("Categoria financeira invalida.");
  }

  const category = await financialCategoriesRepository.getCategoryById(normalized);

  if (!category) {
    throw createBankValidationError("Categoria financeira invalida.");
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

async function listEntries(query = {}) {
  const scope = query.scope ? String(query.scope).trim() : undefined;
  const search = query.search ? String(query.search).trim() : undefined;
  const accountLabel = query.accountLabel
    ? String(query.accountLabel).trim()
    : undefined;
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
    accountLabel,
    financialCategoryId,
    page,
    pageSize,
    startDate,
    endDate,
  });

  const summary = await repository.summarizeEntries({
    scope,
    search,
    accountLabel,
    financialCategoryId,
    startDate,
    endDate,
  });

  return {
    items: result.rows.map((item) => {
      const paymentTypeName = resolveEntryPaymentTypeName(item);

      return {
        id: item.idBankEntry,
        date: item.occurredAt,
        scope: item.scope,
        bank: item.accountLabel || "Banco",
        parcela: resolveEntryInstallmentLabel(item),
        financialCategoryId:
          item.financialCategoryId || item.FinancialCategory?.idFinancialCategory || null,
        financialCategoryDescription:
          item.FinancialCategory?.description || item.category || "DIVERSOS",
        category: item.FinancialCategory?.description || item.category || "DIVERSOS",
        description: resolveDisplayDescription(item.description, paymentTypeName),
        paymentTypeName,
        amount: Number(item.amount),
        amountIn: item.movementType === "IN" ? Number(item.amount) : 0,
        amountOut: item.movementType === "OUT" ? Number(item.amount) : 0,
        balance: Number(item.get("runningBalance") || 0),
        referenceCode: item.referenceCode,
        sourceType: item.sourceType,
        transferKey: item.transferKey || null,
        reversalOfBankEntryId: item.reversalOfBankEntryId || null,
        hasReversal: Boolean(item.get?.("hasReversal") || item.hasReversal),
        canReverse: canReverseEntry(item),
        canDelete:
          item.sourceType === "MANUAL" &&
          !item.transferKey &&
          !item.reversalOfBankEntryId &&
          !String(item.description || "").trim().toUpperCase().startsWith("ESTORNO - "),
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
    },
  };
}

async function listAccountOptions(query = {}) {
  const labels = await repository.listAccountOptions();

  return labels.map((label) => ({
    label,
    value: label,
  }));
}

async function createManualEntry(body = {}) {
  const scope = "LOJA";
  const movementType = normalizeMovementType(body.movementType);
  const financialCategoryId = await getRequiredFinancialCategoryId(body.financialCategoryId);
  const description = normalizeDescription(body.description);
  const amount = normalizeAmount(body.amount, "Valor");
  const occurredAt = normalizeDate(body.occurredAt, "Data") || new Date();
  const referenceCode = normalizeReferenceCode(body.referenceCode);
  const accountLabel = normalizeDescription(body.accountLabel, "Conta");

  const created = await createBankEntry({
    scope,
    movementType,
    financialCategoryId,
    description,
    amount,
    occurredAt,
    sourceType: "MANUAL",
    referenceCode,
    accountLabel,
  });

  return {
    id: created.idBankEntry,
    message: "Lancamento manual criado com sucesso.",
  };
}

async function reverseEntry(idBankEntry, user, body = {}) {
  const normalizedId = Number(idBankEntry);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw createBankValidationError("Lancamento bancario invalido.");
  }

  const reason = normalizeDescription(body.reason, "Motivo");
  const userId = normalizeUserId(user);
  const occurredAt = new Date();

  return sequelize.transaction(async (transaction) => {
    const entry = await repository.getEntryById(normalizedId, transaction);

    if (!entry) {
      throw notFoundError("Lancamento bancario nao encontrado.");
    }

    if (!canReverseEntry(entry)) {
      throw createBankValidationError(
        "Somente lancamentos manuais, transferencias manuais ou vendas canceladas podem ser extornados uma unica vez.",
      );
    }

    const existingReversal = await repository.findReversalByOriginId(normalizedId, transaction);

    if (existingReversal) {
      throw createBankValidationError("Este lancamento ja foi extornado.");
    }

    const categoryDescription =
      entry.FinancialCategory?.description || entry.category || "DIVERSOS";
    const reversalDescription = `ESTORNO - ${entry.description}`;

    const reversedBankEntry = await createBankEntry(
      {
        scope: entry.scope,
        movementType: entry.movementType === "IN" ? "OUT" : "IN",
        financialCategoryId: entry.financialCategoryId || null,
        category: categoryDescription,
        description: reversalDescription,
        accountLabel: entry.accountLabel || "Banco",
        amount: Number(entry.amount),
        occurredAt,
        sourceType: "MANUAL",
        referenceCode: entry.referenceCode || null,
        transferKey: entry.transferKey || null,
        reversalOfBankEntryId: entry.idBankEntry,
      },
      transaction,
    );

    await auditsRepository.createAudit(
      {
        auditTypeId: 4,
        userId,
        occurredAt,
        history: buildAuditHistory("EXTORNO", entry.scope, entry, occurredAt),
        reason,
      },
      transaction,
    );

    if (entry.transferKey) {
      const relatedCashEntry = await cashRepository.findByTransferKey(entry.transferKey, transaction);

      if (relatedCashEntry) {
        const existingCashReversal = await cashRepository.findReversalByOriginId(
          relatedCashEntry.idCashEntry,
          transaction,
        );

        if (!existingCashReversal) {
          await createCashEntry(
            {
              scope: relatedCashEntry.scope,
              movementType: relatedCashEntry.movementType === "IN" ? "OUT" : "IN",
              financialCategoryId: relatedCashEntry.financialCategoryId || null,
              category: relatedCashEntry.category || categoryDescription,
              description: reversalDescription,
              amount: Number(relatedCashEntry.amount),
              occurredAt,
              sourceType: "MANUAL",
              referenceCode: relatedCashEntry.referenceCode || null,
              transferKey: relatedCashEntry.transferKey || null,
              reversalOfCashEntryId: relatedCashEntry.idCashEntry,
            },
            transaction,
          );

          await auditsRepository.createAudit(
            {
              auditTypeId: 3,
              userId,
              occurredAt,
              history: `EXTORNO de ${relatedCashEntry.scope === "LOJA" ? "CAIXA" : "CAIXA PESSOAL"
                } do lancamento ${relatedCashEntry.idCashEntry} em ${new Intl.DateTimeFormat(
                  "pt-BR",
                ).format(occurredAt)}, valor ${Number(relatedCashEntry.amount || 0).toFixed(
                  2,
                )}, descricao ${relatedCashEntry.description}.`,
              reason,
            },
            transaction,
          );
        }
      }
    }

    return {
      id: reversedBankEntry.idBankEntry,
      message: "Extorno registrado com sucesso.",
    };
  });
}

async function deleteEntry(idBankEntry, user, body = {}) {
  const normalizedId = Number(idBankEntry);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw createBankValidationError("Lancamento bancario invalido.");
  }

  const userId = normalizeUserId(user);
  const occurredAt = new Date();
  const reason = normalizeReferenceCode(body.reason);

  return sequelize.transaction(async (transaction) => {
    const entry = await repository.getEntryById(normalizedId, transaction);

    if (!entry) {
      throw notFoundError("Lancamento bancario nao encontrado.");
    }

    if (entry.sourceType !== "MANUAL") {
      throw createBankValidationError("Somente lancamentos manuais podem ser excluidos.");
    }

    if (entry.transferKey) {
      throw createBankValidationError(
        "Lancamentos de transferencia nao podem ser excluidos. Utilize o extorno.",
      );
    }

    if (entry.reversalOfBankEntryId) {
      throw createBankValidationError("Lancamentos de extorno nao podem ser excluidos.");
    }

    const existingReversal = await repository.findReversalByOriginId(normalizedId, transaction);

    if (existingReversal) {
      throw createBankValidationError(
        "Este lancamento possui extorno vinculado e nao pode ser excluido.",
      );
    }

    await repository.deleteEntry(entry, transaction);

    await auditsRepository.createAudit(
      {
        auditTypeId: 4,
        userId,
        occurredAt,
        history: buildAuditHistory("Exclusão", entry.scope, entry, occurredAt),
        reason,
      },
      transaction,
    );

    return {
      message: "Lancamento excluido com sucesso.",
    };
  });
}

module.exports = {
  listEntries,
  listAccountOptions,
  createManualEntry,
  reverseEntry,
  deleteEntry,
};
