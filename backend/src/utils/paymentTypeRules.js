const ENTRY_PAYMENT_TYPE_IDS = new Set([1, 2]);
const CARD_KIND = "CARD";
const BOOKLET_KIND = "BOOKLET";
const INVOICE_KIND = "INVOICE";
const CHECK_KIND = "CHECK";
const CASH_KIND = "CASH";
const TRANSFER_KIND = "TRANSFER";
const IMMEDIATE_CASH_FLOW = "IMMEDIATE_CASH";
const FUTURE_CUSTOMER_FLOW = "FUTURE_CUSTOMER";
const FUTURE_OPERATOR_FLOW = "FUTURE_OPERATOR";

const PAYMENT_TYPE_RULES_BY_ID = {
  1: {
    kind: CASH_KIND,
    requiresDueDate: false,
    allowsEntryAmount: false,
    allowedEntryPaymentKinds: [],
    allowsInstallments: false,
    maxInstallments: 1,
    defaultInstallments: 1,
    financialFlow: IMMEDIATE_CASH_FLOW,
  },
  2: {
    kind: CHECK_KIND,
    requiresDueDate: false,
    allowsEntryAmount: false,
    allowedEntryPaymentKinds: [],
    allowsInstallments: false,
    maxInstallments: 1,
    defaultInstallments: 1,
    financialFlow: IMMEDIATE_CASH_FLOW,
  },
  3: {
    kind: CHECK_KIND,
    requiresDueDate: true,
    allowsEntryAmount: true,
    allowedEntryPaymentKinds: [CASH_KIND, CHECK_KIND],
    allowsInstallments: true,
    maxInstallments: 12,
    defaultInstallments: 1,
    financialFlow: FUTURE_CUSTOMER_FLOW,
  },
  4: {
    kind: BOOKLET_KIND,
    requiresDueDate: true,
    allowsEntryAmount: true,
    allowedEntryPaymentKinds: [CASH_KIND, CHECK_KIND],
    allowsInstallments: true,
    maxInstallments: 12,
    defaultInstallments: 1,
    financialFlow: FUTURE_CUSTOMER_FLOW,
  },
  5: {
    kind: INVOICE_KIND,
    requiresDueDate: true,
    allowsEntryAmount: true,
    allowedEntryPaymentKinds: [CASH_KIND, CHECK_KIND],
    allowsInstallments: true,
    maxInstallments: 12,
    defaultInstallments: 1,
    financialFlow: FUTURE_CUSTOMER_FLOW,
  },
  6: {
    kind: CARD_KIND,
    requiresDueDate: false,
    allowsEntryAmount: true,
    allowedEntryPaymentKinds: [CASH_KIND, CHECK_KIND],
    allowsInstallments: false,
    maxInstallments: 1,
    defaultInstallments: 1,
    financialFlow: FUTURE_OPERATOR_FLOW,
  },
  7: {
    kind: CARD_KIND,
    requiresDueDate: false,
    allowsEntryAmount: true,
    allowedEntryPaymentKinds: [CASH_KIND, CHECK_KIND],
    allowsInstallments: false,
    maxInstallments: 1,
    defaultInstallments: 1,
    financialFlow: FUTURE_OPERATOR_FLOW,
  },
  8: {
    kind: TRANSFER_KIND,
    requiresDueDate: false,
    allowsEntryAmount: false,
    allowedEntryPaymentKinds: [],
    allowsInstallments: false,
    maxInstallments: 1,
    defaultInstallments: 1,
    financialFlow: IMMEDIATE_CASH_FLOW,
  },
};

function normalizePaymentTypeDesc(desc) {
  return String(desc || "")
    .trim()
    .toUpperCase();
}

function getLegacyPaymentTypePreset(paymentType = {}) {
  const paymentTypeId = Number(paymentType.id || paymentType.idPaymentType);
  if (PAYMENT_TYPE_RULES_BY_ID[paymentTypeId]) {
    return PAYMENT_TYPE_RULES_BY_ID[paymentTypeId];
  }

  const normalizedDesc = normalizePaymentTypeDesc(paymentType.desc);

  if (normalizedDesc === "DINHEIRO") {
    return {
      kind: CASH_KIND,
      requiresDueDate: false,
      allowsEntryAmount: false,
      allowedEntryPaymentKinds: [],
      allowsInstallments: false,
      maxInstallments: 1,
      defaultInstallments: 1,
      financialFlow: IMMEDIATE_CASH_FLOW,
    };
  }

  if (normalizedDesc === "CHEQUE DIA") {
    return {
      kind: CHECK_KIND,
      requiresDueDate: false,
      allowsEntryAmount: false,
      allowedEntryPaymentKinds: [],
      allowsInstallments: false,
      maxInstallments: 1,
      defaultInstallments: 1,
      financialFlow: IMMEDIATE_CASH_FLOW,
    };
  }

  if (normalizedDesc === "PIX") {
    return {
      kind: TRANSFER_KIND,
      requiresDueDate: false,
      allowsEntryAmount: false,
      allowedEntryPaymentKinds: [],
      allowsInstallments: false,
      maxInstallments: 1,
      defaultInstallments: 1,
      financialFlow: IMMEDIATE_CASH_FLOW,
    };
  }

  if (
    normalizedDesc === "CHEQUE PRE" ||
    normalizedDesc === "CARNE" ||
    normalizedDesc === "DUPLICATA"
  ) {
    return {
      kind:
        normalizedDesc === "CARNE"
          ? BOOKLET_KIND
          : normalizedDesc === "DUPLICATA"
            ? INVOICE_KIND
            : CHECK_KIND,
      requiresDueDate: true,
      allowsEntryAmount: true,
      allowedEntryPaymentKinds: [CASH_KIND, CHECK_KIND],
      allowsInstallments: true,
      maxInstallments: 12,
      defaultInstallments: 1,
      financialFlow: FUTURE_CUSTOMER_FLOW,
    };
  }

  if (normalizedDesc.startsWith("CARTAO")) {
    return {
      kind: CARD_KIND,
      requiresDueDate: false,
      allowsEntryAmount: true,
      allowedEntryPaymentKinds: [CASH_KIND, CHECK_KIND],
      allowsInstallments: false,
      maxInstallments: 1,
      defaultInstallments: 1,
      financialFlow: FUTURE_OPERATOR_FLOW,
    };
  }

  return null;
}

function normalizeAllowedEntryPaymentKinds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim().toUpperCase())
    .filter(Boolean);
}

function buildPaymentTypeResponse(item) {
  const derivedRules =
    getLegacyPaymentTypePreset(item) || {
      kind: CASH_KIND,
      requiresDueDate: false,
      allowsEntryAmount: false,
      allowedEntryPaymentKinds: [],
      allowsInstallments: false,
      maxInstallments: 1,
      defaultInstallments: 1,
      financialFlow: IMMEDIATE_CASH_FLOW,
    };

  return {
    id: item.idPaymentType,
    name: item.desc,
    desc: item.desc,
    kind: derivedRules.kind,
    active: true,
    requiresDueDate: Boolean(derivedRules.requiresDueDate),
    allowsEntryAmount: Boolean(derivedRules.allowsEntryAmount),
    allowedEntryPaymentKinds: normalizeAllowedEntryPaymentKinds(
      derivedRules.allowedEntryPaymentKinds,
    ),
    allowsInstallments: Boolean(derivedRules.allowsInstallments),
    maxInstallments:
      derivedRules.maxInstallments === null || derivedRules.maxInstallments === undefined
        ? null
        : Number(derivedRules.maxInstallments),
    defaultInstallments: Number(derivedRules.defaultInstallments || 1),
    financialFlow: derivedRules.financialFlow || IMMEDIATE_CASH_FLOW,
  };
}

function inferFinancialFlowFromKind(kind) {
  switch (kind) {
    case CARD_KIND:
      return FUTURE_OPERATOR_FLOW;
    case BOOKLET_KIND:
    case INVOICE_KIND:
      return FUTURE_CUSTOMER_FLOW;
    default:
      return IMMEDIATE_CASH_FLOW;
  }
}

function isCardPaymentType(paymentType) {
  return paymentType?.kind === CARD_KIND || paymentType?.financialFlow === FUTURE_OPERATOR_FLOW;
}

function isImmediateEntryPaymentType(paymentType) {
  return ENTRY_PAYMENT_TYPE_IDS.has(Number(paymentType?.id || paymentType?.idPaymentType));
}

function isImmediateCashPaymentType(paymentType) {
  const paymentTypeId = Number(paymentType?.id || paymentType?.idPaymentType);
  const paymentTypeName = normalizePaymentTypeDesc(paymentType?.name || paymentType?.desc);

  return (
    (paymentTypeId === 1 || paymentTypeName === "DINHEIRO") &&
    paymentType?.financialFlow === IMMEDIATE_CASH_FLOW
  );
}

function isImmediateCheckPaymentType(paymentType) {
  return paymentType?.kind === CHECK_KIND && paymentType?.financialFlow === IMMEDIATE_CASH_FLOW;
}

module.exports = {
  BOOKLET_KIND,
  INVOICE_KIND,
  CARD_KIND,
  CHECK_KIND,
  CASH_KIND,
  TRANSFER_KIND,
  IMMEDIATE_CASH_FLOW,
  FUTURE_CUSTOMER_FLOW,
  FUTURE_OPERATOR_FLOW,
  ENTRY_PAYMENT_TYPE_IDS,
  normalizeAllowedEntryPaymentKinds,
  buildPaymentTypeResponse,
  getLegacyPaymentTypePreset,
  inferFinancialFlowFromKind,
  isCardPaymentType,
  isImmediateCashPaymentType,
  isImmediateCheckPaymentType,
  isImmediateEntryPaymentType,
};
