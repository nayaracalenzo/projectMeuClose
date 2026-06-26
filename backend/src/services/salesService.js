const repository = require("../repositories/salesRepository");
const paymentTypesRepository = require("../repositories/paymentTypesRepository");
const {
  buildPaymentTypeResponse,
  isCardPaymentType,
  isImmediateEntryPaymentType,
} = require("../utils/paymentTypeRules");

const MEASUREMENT_FIELDS = [
  "costas",
  "comprimentoSaia",
  "comprimentoBlusa",
  "comprimentoCalca",
  "comprimentoManga",
  "comprimentoVestido",
  "comprimentoBermuda",
  "cos",
  "colete",
  "perna",
  "braco",
  "alturaBusto",
  "busto",
  "cintura",
  "coice",
  "cinturaBaixa",
  "quadril",
  "gancho",
];

class SalesValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "SalesValidationError";
    this.statusCode = statusCode;
  }
}

function normalizeDecimal(value, fieldName) {
  if (value === null || value === undefined || value === "") return null;

  const normalized = Number(String(value).replace(",", "."));

  if (!Number.isFinite(normalized)) {
    throw new SalesValidationError(`${fieldName} invalido.`);
  }

  return normalized;
}

function normalizeInteger(value, fieldName) {
  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new SalesValidationError(`${fieldName} invalido.`);
  }

  return normalized;
}

function normalizeDate(value, fieldName) {
  if (!value) return null;

  const raw = String(value).trim();
  const base = raw.includes("T") ? raw.split("T")[0] : raw;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);

  if (!match) {
    throw new SalesValidationError(`${fieldName} invalida.`);
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  if (Number.isNaN(date.getTime())) {
    throw new SalesValidationError(`${fieldName} invalida.`);
  }

  return date;
}

function addMonths(baseDate, monthsToAdd) {
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + monthsToAdd,
    baseDate.getDate(),
    0,
    0,
    0,
    0
  );
}

function roundCurrency(value) {
  return Number(Number(value).toFixed(2));
}

function buildInstallments(amount, installmentCount, paymentTypeId, dueDate) {
  const amounts = [];
  let allocated = 0;

  for (let index = 0; index < installmentCount; index += 1) {
    const remainingInstallments = installmentCount - index;
    const remainingAmount = roundCurrency(amount - allocated);
    const installmentAmount =
      remainingInstallments === 1
        ? remainingAmount
        : roundCurrency(remainingAmount / remainingInstallments);

    allocated = roundCurrency(allocated + installmentAmount);
    amounts.push(installmentAmount);
  }

  return amounts.map((installmentAmount, index) => ({
    paymentTypeId,
    installmentNumber: index + 1,
    totalInstallments: installmentCount,
    dueDate: addMonths(dueDate || new Date(), index),
    amount: installmentAmount,
    paidAmount: 0,
    status: "OPEN",
  }));
}

function normalizeMeasurementRecord(record = {}) {
  const normalized = {};
  let hasAnyValue = false;

  for (const field of MEASUREMENT_FIELDS) {
    const value = normalizeDecimal(record[field], `Medida ${field}`);
    normalized[field] = value;
    if (value !== null) {
      hasAnyValue = true;
    }
  }

  return hasAnyValue ? normalized : null;
}

function normalizeSaleItem(item = {}) {
  const itemType = String(item.itemType || "").trim();

  if (itemType !== "READY_MADE" && itemType !== "CUSTOM_MADE") {
    throw new SalesValidationError("Tipo de item invalido.");
  }

  const description = String(item.description || "").trim();

  if (!description) {
    throw new SalesValidationError("Descricao do item e obrigatoria.");
  }

  const quantity = normalizeInteger(item.quantity ?? 1, "Quantidade do item");
  const unitPrice = normalizeDecimal(item.unitPrice, "Valor unitario do item");
  const subtotal = normalizeDecimal(item.subtotal, "Subtotal do item");

  if (unitPrice === null || subtotal === null) {
    throw new SalesValidationError("Valores do item sao obrigatorios.");
  }

  return {
    productId: item.productId ? normalizeInteger(item.productId, "Produto") : null,
    itemType,
    description,
    metadata: item.metadata || null,
    quantity,
    unitPrice,
    discountType:
      item.discountType === "PERCENTAGE" || item.discountType === "FIXED"
        ? item.discountType
        : null,
    discountValue: normalizeDecimal(item.discountValue, "Desconto do item"),
    subtotal,
  };
}

async function getRequiredPaymentType(idPaymentType, fieldName) {
  const normalizedId = normalizeInteger(idPaymentType, fieldName);
  const paymentType = await paymentTypesRepository.getPaymentTypeById(normalizedId);

  if (!paymentType || !paymentType.active) {
    throw new SalesValidationError(`${fieldName} invalida.`);
  }

  return buildPaymentTypeResponse(paymentType);
}

function validateInstallmentCount(paymentType, installmentCount) {
  if (!paymentType.allowsInstallments && installmentCount > 1) {
    throw new SalesValidationError("A forma de pagamento selecionada nao permite parcelamento.");
  }

  if (paymentType.maxInstallments && installmentCount > paymentType.maxInstallments) {
    throw new SalesValidationError("Quantidade de parcelas acima do limite permitido.");
  }
}

function validateEntryPaymentType(mainPaymentType, entryPaymentType) {
  if (!mainPaymentType.allowsEntryAmount) {
    throw new SalesValidationError("A forma de pagamento selecionada nao permite entrada.");
  }

  if (!mainPaymentType.allowedEntryPaymentKinds.includes(entryPaymentType.kind)) {
    throw new SalesValidationError("Forma de pagamento da entrada invalida.");
  }

  if (!isImmediateEntryPaymentType(entryPaymentType)) {
    throw new SalesValidationError("A entrada so pode ser recebida em Dinheiro ou Cheque Dia.");
  }
}

function buildReceivablePayload({
  customerId,
  mainPaymentType,
  paymentTypeId,
  remainingAmount,
  installmentCount,
  dueDate,
  cardData,
}) {
  if (remainingAmount <= 0) {
    return null;
  }

  const debtorType = mainPaymentType.financialFlow === "FUTURE_OPERATOR" ? "CARD_OPERATOR" : "CUSTOMER";
  const effectiveDueDate = dueDate || cardData.expectedSettlementDate || new Date();
  const effectiveInstallmentCount = mainPaymentType.allowsInstallments ? installmentCount : 1;

  return {
    originalAmount: remainingAmount,
    debtorType,
    customerId: debtorType === "CUSTOMER" ? customerId : null,
    operatorLabel: debtorType === "CARD_OPERATOR" ? cardData.operatorLabel : null,
    installments: buildInstallments(
      remainingAmount,
      effectiveInstallmentCount,
      paymentTypeId,
      effectiveDueDate
    ),
    cardTransaction:
      debtorType === "CARD_OPERATOR"
        ? {
            operatorLabel: cardData.operatorLabel,
            cardBrand: cardData.cardBrand,
            authorizationCode: cardData.authorizationCode,
            clientInstallmentCount: cardData.clientInstallmentCount,
            grossAmount: cardData.grossAmount,
            entryAmount: cardData.entryAmount,
            netReceivableAmount: remainingAmount,
            feeAmount: cardData.feeAmount,
            expectedSettlementDate: cardData.expectedSettlementDate,
            settlementStatus: "PENDING",
          }
        : null,
  };
}

async function createSale(body = {}) {
  const customerId = normalizeInteger(body.customerId, "Cliente");
  const items = Array.isArray(body.items) ? body.items.map(normalizeSaleItem) : [];

  if (!items.length) {
    throw new SalesValidationError("Adicione ao menos um item na venda.");
  }

  const totalAmount = normalizeDecimal(body.totalAmount, "Valor total");
  const finalAmount = normalizeDecimal(body.finalAmount, "Valor final");

  if (totalAmount === null || finalAmount === null) {
    throw new SalesValidationError("Valores totais sao obrigatorios.");
  }

  const mainPaymentType = await getRequiredPaymentType(body.paymentTypeId, "Forma de pagamento");
  const installmentCount =
    body.installmentCount === null || body.installmentCount === undefined || body.installmentCount === ""
      ? Number(mainPaymentType.defaultInstallments || 1)
      : normalizeInteger(body.installmentCount, "Quantidade de parcelas");

  validateInstallmentCount(mainPaymentType, installmentCount);

  const dueDate = normalizeDate(body.dueDate, "Data de vencimento");
  if (mainPaymentType.requiresDueDate && !dueDate) {
    throw new SalesValidationError("Data de vencimento e obrigatoria.");
  }

  if (!mainPaymentType.requiresDueDate && !isCardPaymentType(mainPaymentType) && dueDate) {
    throw new SalesValidationError("A forma de pagamento selecionada nao utiliza vencimento futuro.");
  }

  const entryAmount =
    body.entryAmount === null || body.entryAmount === undefined || body.entryAmount === ""
      ? 0
      : normalizeDecimal(body.entryAmount, "Valor da entrada");

  let entryReceipt = null;
  let entryPaymentType = null;

  if (entryAmount !== null && entryAmount > 0) {
    entryPaymentType = await getRequiredPaymentType(body.entryPaymentTypeId, "Forma de pagamento da entrada");
    validateEntryPaymentType(mainPaymentType, entryPaymentType);

    if (entryAmount >= finalAmount) {
      throw new SalesValidationError("O valor da entrada deve ser menor que o valor final.");
    }

    entryReceipt = {
      paymentTypeId: entryPaymentType.id,
      amount: roundCurrency(entryAmount),
      paidAt: normalizeDate(body.entryPaidAt, "Data da entrada") || new Date(),
      referenceCode: body.entryReferenceCode ? String(body.entryReferenceCode).trim() : null,
    };
  } else if (body.entryPaymentTypeId || body.entryPaidAt || body.entryReferenceCode) {
    throw new SalesValidationError("Informe um valor de entrada valido para registrar a entrada.");
  }

  if (!entryReceipt && mainPaymentType.financialFlow === "IMMEDIATE_CASH") {
    entryReceipt = {
      paymentTypeId: mainPaymentType.id,
      amount: roundCurrency(finalAmount),
      paidAt: new Date(),
      referenceCode: body.entryReferenceCode ? String(body.entryReferenceCode).trim() : null,
    };
  }

  const customerMeasurements = Array.isArray(body.customerMeasurements)
    ? body.customerMeasurements.map(normalizeMeasurementRecord).filter(Boolean)
    : [];

  const remainingAmount = roundCurrency(finalAmount - (entryReceipt?.amount || 0));
  const cardClientInstallmentCount =
    body.cardClientInstallmentCount === null ||
    body.cardClientInstallmentCount === undefined ||
    body.cardClientInstallmentCount === ""
      ? installmentCount
      : normalizeInteger(body.cardClientInstallmentCount, "Parcelas no cartao");

  const cardFeeAmount =
    body.cardFeeAmount === null || body.cardFeeAmount === undefined || body.cardFeeAmount === ""
      ? 0
      : normalizeDecimal(body.cardFeeAmount, "Taxa do cartao");

  if (cardFeeAmount !== null && cardFeeAmount < 0) {
    throw new SalesValidationError("Taxa do cartao invalida.");
  }

  const cardData = {
    operatorLabel: body.cardOperatorLabel ? String(body.cardOperatorLabel).trim() : null,
    cardBrand: body.cardBrand ? String(body.cardBrand).trim() : null,
    authorizationCode: body.cardAuthorizationCode ? String(body.cardAuthorizationCode).trim() : null,
    clientInstallmentCount: cardClientInstallmentCount,
    grossAmount: roundCurrency(finalAmount),
    entryAmount: roundCurrency(entryReceipt?.amount || 0),
    feeAmount: roundCurrency(cardFeeAmount || 0),
    expectedSettlementDate:
      normalizeDate(body.cardExpectedSettlementDate, "Data prevista de repasse") || dueDate || null,
  };

  if (mainPaymentType.financialFlow === "FUTURE_OPERATOR" && !cardData.expectedSettlementDate) {
    throw new SalesValidationError("Data prevista de repasse e obrigatoria para cartao.");
  }

  const receivable = buildReceivablePayload({
    customerId,
    mainPaymentType,
    paymentTypeId: mainPaymentType.id,
    remainingAmount,
    installmentCount,
    dueDate,
    cardData,
  });

  const created = await repository.createSale({
    sale: {
      customerId,
      userId: body.userId ? normalizeInteger(body.userId, "Usuario") : null,
      discountType:
        body.discountType === "PERCENTAGE" || body.discountType === "FIXED"
          ? body.discountType
          : null,
      discountValue: normalizeDecimal(body.discountValue, "Desconto da venda"),
      totalAmount,
      finalAmount,
      status:
        body.status === "COMPLETED" || body.status === "CANCELLED"
          ? body.status
          : "OPEN",
      dueDate: dueDate || cardData.expectedSettlementDate,
      paymentTypeId: mainPaymentType.id,
      installmentCount,
    },
    items,
    customerMeasurements,
    entryReceipt,
    receivable,
  });

  return {
    id: created.sale.idSale,
    customerId: created.sale.customerId,
    totalAmount: Number(created.sale.totalAmount),
    finalAmount: Number(created.sale.finalAmount),
    status: created.sale.status,
    itemsCount: created.items.length,
    measurementsCount: created.measurements.length,
    entryReceiptId: created.entryReceipt?.idPaymentReceipt || null,
    receivableId: created.receivable?.receivable?.idReceivable || null,
    paymentPreview: {
      paymentTypeId: mainPaymentType.id,
      paymentTypeName: mainPaymentType.name,
      entryAmount: roundCurrency(entryReceipt?.amount || 0),
      remainingAmount,
      debtorType: receivable?.debtorType || null,
      installments:
        receivable?.installments.map((installment) => ({
          installmentNumber: installment.installmentNumber,
          totalInstallments: installment.totalInstallments,
          dueDate: installment.dueDate,
          amount: installment.amount,
        })) || [],
    },
  };
}

module.exports = {
  MEASUREMENT_FIELDS,
  SalesValidationError,
  createSale,
};
