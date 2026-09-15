const { validationError, notFoundError } = require("../errors/AppError");
const crypto = require("crypto");

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const isInactive = (item) => Boolean(item.deletionAuditId) || item.status === "CANCELLED";
const openBalance = (item) => isInactive(item) || item.status === "PAID"
  ? 0 : Math.max(0, money(Number(item.amount) - Number(item.paidAmount || 0)));

function ensureActive(item) {
  if (!item || !item.Receivable) throw notFoundError("Parcela não encontrada.");
  if (isInactive(item) || item.Receivable.status === "CANCELLED") {
    throw validationError("Esta parcela foi cancelada ou excluída e não pode ser movimentada.");
  }
}

function summarize(items) {
  const active = items.filter((item) => !isInactive(item));
  const openAmount = money(active.reduce((sum, item) => sum + openBalance(item), 0));
  const paidAmount = money(items.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0));
  return {
    openAmount,
    waivedAmount: money(items.reduce((sum, item) => sum + Number(item.waivedAmount || 0), 0)),
    installmentCount: active.length,
    status: openAmount > 0 ? (paidAmount > 0 ? "PARTIAL" : "OPEN") : active.length ? "PAID" : "CANCELLED",
  };
}

function deletionPreview(item, items) {
  ensureActive(item);
  const waivedAmount = openBalance(item);
  if (waivedAmount <= 0) throw validationError("Somente parcelas com saldo em aberto podem ser excluídas.");
  const summary = summarize(items);
  const snapshot = items.slice().sort((a, b) => a.idReceivableInstallment - b.idReceivableInstallment)
    .map((row) => [row.idReceivableInstallment, row.amount, row.paidAmount, row.status,
      row.deletionAuditId, row.waivedAmount, row.updatedAt]);
  const previewToken = crypto.createHash("sha256").update(JSON.stringify([
    item.idReceivableInstallment, item.Receivable.saleId, item.Receivable.updatedAt, snapshot,
  ])).digest("hex");
  return {
    installmentId: item.idReceivableInstallment,
    saleId: item.Receivable.saleId || null,
    amount: money(item.amount),
    paidAmount: money(item.paidAmount),
    waivedAmount,
    openAmountBefore: summary.openAmount,
    openAmountAfter: money(summary.openAmount - waivedAmount),
    previewToken,
  };
}

module.exports = { money, isInactive, openBalance, ensureActive, summarize, deletionPreview };
