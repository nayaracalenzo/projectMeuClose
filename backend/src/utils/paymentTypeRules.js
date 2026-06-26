const ENTRY_PAYMENT_TYPE_IDS = new Set([1, 2]);
const CARD_KIND = "CARD";
const BOOKLET_KIND = "BOOKLET";
const INVOICE_KIND = "INVOICE";

function normalizeAllowedEntryPaymentKinds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim().toUpperCase())
    .filter(Boolean);
}

function buildPaymentTypeResponse(item) {
  return {
    id: item.idPaymentType,
    name: item.desc,
    kind: item.kind,
    active: item.active,
    requiresDueDate: Boolean(item.requiresDueDate),
    allowsEntryAmount: Boolean(item.allowsEntryAmount),
    allowedEntryPaymentKinds: normalizeAllowedEntryPaymentKinds(item.allowedEntryPaymentKinds),
    allowsInstallments: Boolean(item.allowsInstallments),
    maxInstallments: item.maxInstallments === null || item.maxInstallments === undefined ? null : Number(item.maxInstallments),
    defaultInstallments: Number(item.defaultInstallments || 1),
    financialFlow: item.financialFlow || "IMMEDIATE_CASH",
  };
}

function inferFinancialFlowFromKind(kind) {
  switch (kind) {
    case CARD_KIND:
      return "FUTURE_OPERATOR";
    case BOOKLET_KIND:
    case INVOICE_KIND:
      return "FUTURE_CUSTOMER";
    default:
      return "IMMEDIATE_CASH";
  }
}

function isCardPaymentType(paymentType) {
  return paymentType?.kind === CARD_KIND || paymentType?.financialFlow === "FUTURE_OPERATOR";
}

function isImmediateEntryPaymentType(paymentType) {
  return ENTRY_PAYMENT_TYPE_IDS.has(Number(paymentType?.id || paymentType?.idPaymentType));
}

module.exports = {
  BOOKLET_KIND,
  INVOICE_KIND,
  CARD_KIND,
  ENTRY_PAYMENT_TYPE_IDS,
  normalizeAllowedEntryPaymentKinds,
  buildPaymentTypeResponse,
  inferFinancialFlowFromKind,
  isCardPaymentType,
  isImmediateEntryPaymentType,
};
