const { validationError } = require("../errors/AppError");
const repository = require("../repositories/bankRepository");

function normalizeDate(value, fieldName, options = {}) {
  if (!value) return null;

  const base = String(value).trim().split("T")[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);

  if (!match) {
    throw validationError(`${fieldName} invalida.`);
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

  return item.referenceCode ? String(item.referenceCode) : "-";
}

async function listEntries(query = {}) {
  const scope = query.scope ? String(query.scope).trim() : undefined;
  const search = query.search ? String(query.search).trim() : undefined;
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
  const startDate = normalizeDate(query.startDate, "Data inicial");
  const endDate = normalizeDate(query.endDate, "Data final", { endOfDay: true });

  const result = await repository.listEntries({
    scope,
    search,
    page,
    pageSize,
    startDate,
    endDate,
  });

  const summary = await repository.summarizeEntries({
    scope,
    search,
    startDate,
    endDate,
  });

  return {
    items: result.rows.map((item) => ({
      id: item.idBankEntry,
      date: item.occurredAt,
      scope: item.scope,
      bank: item.accountLabel || "Banco da Loja",
      parcela: resolveEntryInstallmentLabel(item),
      financialCategoryId:
        item.financialCategoryId || item.FinancialCategory?.idFinancialCategory || null,
      financialCategoryDescription:
        item.FinancialCategory?.description || item.category || "DIVERSOS",
      category: item.FinancialCategory?.description || item.category || "DIVERSOS",
      description: item.description,
      amount: Number(item.amount),
      amountIn: item.movementType === "IN" ? Number(item.amount) : 0,
      amountOut: item.movementType === "OUT" ? Number(item.amount) : 0,
      balance: Number(item.get("runningBalance") || 0),
      referenceCode: item.referenceCode,
      transferKey: item.transferKey || null,
      reversalOfBankEntryId: item.reversalOfBankEntryId || null,
    })),
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
  const scope = query.scope ? String(query.scope).trim() : undefined;
  const labels = await repository.listAccountOptions(scope);

  return labels.map((label) => ({
    label,
    value: label,
  }));
}

module.exports = {
  listEntries,
  listAccountOptions,
};
