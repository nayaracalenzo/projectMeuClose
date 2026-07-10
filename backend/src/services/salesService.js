const { notFoundError, validationError } = require("../errors/AppError");
const repository = require("../repositories/salesRepository");
const paymentTypesRepository = require("../repositories/paymentTypesRepository");
const {
  buildPaymentTypeResponse,
  isCardPaymentType,
  isImmediateCashPaymentType,
  isImmediateCheckPaymentType,
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

function createSalesValidationError(message, statusCode = 400) {
  const error = validationError(message, {
    name: "SalesValidationError",
    code: "SALES_VALIDATION_ERROR",
  });
  error.statusCode = statusCode;
  return error;
}

function normalizeDecimal(value, fieldName) {
  if (value === null || value === undefined || value === "") return null;

  const normalized = Number(String(value).replace(",", "."));

  if (!Number.isFinite(normalized)) {
    throw createSalesValidationError(`${fieldName} invalido.`);
  }

  return normalized;
}

function normalizeInteger(value, fieldName) {
  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw createSalesValidationError(`${fieldName} invalido.`);
  }

  return normalized;
}

function normalizeDate(value, fieldName) {
  if (!value) return null;

  const raw = String(value).trim();
  const base = raw.includes("T") ? raw.split("T")[0] : raw;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);

  if (!match) {
    throw createSalesValidationError(`${fieldName} invalida.`);
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  if (Number.isNaN(date.getTime())) {
    throw createSalesValidationError(`${fieldName} invalida.`);
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
    0,
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

  if (
    itemType !== "READY_MADE" &&
    itemType !== "CUSTOM_MADE" &&
    itemType !== "ACCESSORY" &&
    itemType !== "SERVICE" &&
    itemType !== "MISC"
  ) {
    throw createSalesValidationError("Tipo de item invalido.");
  }

  const description = String(item.description || "").trim();

  if (!description) {
    throw createSalesValidationError("Descrição do item e obrigatoria.");
  }

  const quantity = normalizeInteger(item.quantity ?? 1, "Quantidade do item");
  const unitPrice = normalizeDecimal(item.unitPrice, "Valor unitario do item");
  const subtotal = normalizeDecimal(item.subtotal, "Subtotal do item");

  if (unitPrice === null || subtotal === null) {
    throw createSalesValidationError("Valores do item sao obrigatorios.");
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

  if (!paymentType) {
    throw createSalesValidationError(`${fieldName} invalida.`);
  }

  return buildPaymentTypeResponse(paymentType);
}

function validateInstallmentCount(paymentType, installmentCount) {
  if (!paymentType.allowsInstallments && installmentCount > 1) {
    throw createSalesValidationError("A forma de pagamento selecionada nao permite parcelamento.");
  }

  if (paymentType.maxInstallments && installmentCount > paymentType.maxInstallments) {
    throw createSalesValidationError("Quantidade de parcelas acima do limite permitido.");
  }
}

function validateEntryPaymentType(mainPaymentType, entryPaymentType) {
  if (!mainPaymentType.allowsEntryAmount) {
    throw createSalesValidationError("A forma de pagamento selecionada nao permite entrada.");
  }

  if (!mainPaymentType.allowedEntryPaymentKinds.includes(entryPaymentType.kind)) {
    throw createSalesValidationError("Forma de pagamento da entrada invalida.");
  }

  if (!isImmediateEntryPaymentType(entryPaymentType)) {
    throw createSalesValidationError("A entrada so pode ser recebida em Dinheiro ou Cheque Dia.");
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

  const debtorType =
    mainPaymentType.financialFlow === "FUTURE_OPERATOR" ? "CARD_OPERATOR" : "CUSTOMER";
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
      effectiveDueDate,
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

function buildIncomingFinancialMovement({ paymentType, amount, paidAt, referenceCode }) {
  if (!paymentType || Number(amount) <= 0) {
    return null;
  }

  if (paymentType.financialFlow !== "IMMEDIATE_CASH") {
    return null;
  }

  return {
    target: isImmediateCashPaymentType(paymentType) ? "CASH" : "BANK",
    scope: "LOJA",
    movementType: "IN",
    category: "VENDA",
    description: `Recebimento da venda via ${paymentType.name}`,
    accountLabel: "Banco da Loja",
    amount: roundCurrency(amount),
    occurredAt: paidAt || new Date(),
    paymentTypeId: paymentType.id,
    referenceCode: referenceCode || null,
    sourceType: "SALE_RECEIPT",
  };
}

function mapSaleItem(item) {
  const product = item.Product || item.Products;
  const employee = product?.Employee || product?.Employees;
  const status = product?.Status;
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || 0);
  const subtotal = Number(item.subtotal || 0);
  const grossAmount = Number((quantity * unitPrice).toFixed(2));
  const discountAmount = Number(Math.max(0, grossAmount - subtotal).toFixed(2));

  return {
    id: item.idSaleItem,
    productId: item.productId || null,
    itemType: item.itemType,
    description: item.description,
    quantity,
    unitPrice,
    discountType: item.discountType || null,
    discountValue:
      item.discountValue === null || item.discountValue === undefined
        ? null
        : Number(item.discountValue),
    grossAmount,
    discountAmount,
    subtotal,
    metadata: item.metadata || null,
    productStatus: status?.desc || null,
    seamstress: employee?.shortName || employee?.fullName || null,
    fittingDate: product?.testDate || null,
  };
}

function resolveSaleStatus(sale) {
  const isLegacyCompleted =
    typeof sale?.get === "function"
      ? Boolean(sale.get("isLegacyCompleted"))
      : Boolean(sale?.isLegacyCompleted);

  if (sale?.status === "BUDGET" && isLegacyCompleted) {
    return "COMPLETED";
  }

  return sale?.status || null;
}

function mapPaymentReceipt(receipt) {
  const paymentType = receipt.PaymentType || receipt.PaymentTypes;

  return {
    id: receipt.idPaymentReceipt,
    saleId: receipt.saleId,
    receivableInstallmentId: receipt.receivableInstallmentId || null,
    receiptType: receipt.receiptType,
    amount: Number(receipt.amount || 0),
    paidAt: receipt.paidAt,
    referenceCode: receipt.referenceCode || null,
    paymentType: paymentType
      ? {
        id: paymentType.idPaymentType,
        name: paymentType.desc,
      }
      : null,
  };
}

function mapReceivableInstallment(installment) {
  const paymentType = installment.PaymentType || installment.PaymentTypes;

  return {
    id: installment.idReceivableInstallment,
    installmentNumber: Number(installment.installmentNumber || 0),
    totalInstallments: Number(installment.totalInstallments || 0),
    dueDate: installment.dueDate,
    amount: Number(installment.amount || 0),
    paidAmount: Number(installment.paidAmount || 0),
    openAmount: Number((Number(installment.amount || 0) - Number(installment.paidAmount || 0)).toFixed(2)),
    status: installment.status,
    paymentType: paymentType
      ? {
        id: paymentType.idPaymentType,
        name: paymentType.desc,
      }
      : null,
  };
}

function resolveReceivableOrigin(receivable, customer) {
  const supplier = receivable?.Supplier || receivable?.Suppliers || null;
  const supplierName = supplier?.tradeName || supplier?.fullName || null;
  const customerName = customer?.fullName || customer?.companyName || null;

  if (receivable?.debtorType === "CARD_OPERATOR") {
    return {
      originType: "CARD_OPERATOR",
      originLabel: "Operadora",
      originName: receivable.operatorLabel || "Operadora",
      supplierId: supplier?.idSupplier || receivable?.supplierId || null,
      supplierName,
    };
  }

  if (supplierName) {
    return {
      originType: "SUPPLIER",
      originLabel: "Fornecedor",
      originName: supplierName,
      supplierId: supplier?.idSupplier || receivable?.supplierId || null,
      supplierName,
    };
  }

  return {
    originType: "CUSTOMER",
    originLabel: "Cliente",
    originName: customerName || "Cliente",
    supplierId: supplier?.idSupplier || receivable?.supplierId || null,
    supplierName,
  };
}

function mapSaleDetails(sale) {
  const customer = sale.Customer || sale.Customers;
  const user = sale.User || sale.Users;
  const paymentType = sale.PaymentType || sale.PaymentTypes;
  const receivable = sale.Receivable || sale.Receivables;
  const cardTransaction = sale.CardTransaction || sale.CardTransactions || receivable?.CardTransaction || receivable?.CardTransactions || null;
  const receivableOrigin = receivable ? resolveReceivableOrigin(receivable, customer) : null;
  const items = Array.isArray(sale.SaleItems) ? sale.SaleItems.map(mapSaleItem) : [];
  const receipts = Array.isArray(sale.PaymentReceipts)
    ? sale.PaymentReceipts.map(mapPaymentReceipt)
    : [];
  const measurementsCount = Array.isArray(sale.CustomerMeasurements)
    ? sale.CustomerMeasurements.length
    : 0;

  return {
    id: sale.idSale,
    status: resolveSaleStatus(sale),
    customer: customer
      ? {
        id: customer.idCustomer,
        name: customer.fullName || customer.companyName || "Sem cliente",
      }
      : null,
    user: user
      ? {
        id: Number(user.idUser),
        name: user.name || user.username,
      }
      : null,
    paymentType: paymentType
      ? {
        id: paymentType.idPaymentType,
        name: paymentType.desc,
      }
      : null,
    discountType: sale.discountType || null,
    discountValue:
      sale.discountValue === null || sale.discountValue === undefined
        ? null
        : Number(sale.discountValue),
    totalAmount: Number(sale.totalAmount || 0),
    finalAmount: Number(sale.finalAmount || 0),
    dueDate: sale.dueDate,
    installmentCount: Number(sale.installmentCount || 1),
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    items,
    receipts,
    measurementsCount,
    receivable: receivable
      ? {
        id: receivable.idReceivable,
        debtorType: receivable.debtorType,
        operatorLabel: receivable.operatorLabel || null,
        supplierId: receivableOrigin?.supplierId || null,
        supplierName: receivableOrigin?.supplierName || null,
        originType: receivableOrigin?.originType || "CUSTOMER",
        originLabel: receivableOrigin?.originLabel || "Cliente",
        originName: receivableOrigin?.originName || customer?.fullName || customer?.companyName || "Cliente",
        originalAmount: Number(receivable.originalAmount || 0),
        openAmount: Number(receivable.openAmount || 0),
        status: receivable.status,
        installments: Array.isArray(receivable.ReceivableInstallments)
          ? receivable.ReceivableInstallments.map(mapReceivableInstallment)
          : [],
      }
      : null,
    cardTransaction: cardTransaction
      ? {
        id: cardTransaction.idCardTransaction,
        operatorLabel: cardTransaction.operatorLabel || null,
        cardBrand: cardTransaction.cardBrand || null,
        authorizationCode: cardTransaction.authorizationCode || null,
        clientInstallmentCount: Number(cardTransaction.clientInstallmentCount || 1),
        grossAmount: Number(cardTransaction.grossAmount || 0),
        entryAmount: Number(cardTransaction.entryAmount || 0),
        netReceivableAmount: Number(cardTransaction.netReceivableAmount || 0),
        feeAmount: Number(cardTransaction.feeAmount || 0),
        expectedSettlementDate: cardTransaction.expectedSettlementDate || null,
        settlementStatus: cardTransaction.settlementStatus,
      }
      : null,
  };
}

function mapSaleListItem(sale) {
  const customer = sale.Customer || sale.Customers;
  const paymentType = sale.PaymentType || sale.PaymentTypes;
  const items = Array.isArray(sale.SaleItems) ? sale.SaleItems : [];

  return {
    id: sale.idSale,
    status: resolveSaleStatus(sale),
    customerName: customer?.fullName || customer?.companyName || "Sem cliente",
    paymentTypeName: paymentType?.desc || null,
    itemsCount: items.length,
    firstItemDescription: items[0]?.description || null,
    finalAmount: Number(sale.finalAmount || 0),
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  };
}

async function createSale(body = {}) {
  return finalizeSaleFromScratch(body);
}

function normalizeQuoteBase(body = {}) {
  const customerId = normalizeInteger(body.customerId, "Cliente");
  const items = Array.isArray(body.items) ? body.items.map(normalizeSaleItem) : [];

  if (!items.length) {
    throw createSalesValidationError("Adicione ao menos um item na venda.");
  }

  const totalAmount = normalizeDecimal(body.totalAmount, "Valor total");
  const finalAmount = normalizeDecimal(body.finalAmount, "Valor final");

  if (totalAmount === null || finalAmount === null) {
    throw createSalesValidationError("Valores totais sao obrigatorios.");
  }

  const customerMeasurements = Array.isArray(body.customerMeasurements)
    ? body.customerMeasurements.map(normalizeMeasurementRecord).filter(Boolean)
    : [];

  return {
    customerId,
    items,
    totalAmount,
    finalAmount,
    customerMeasurements,
    userId: body.userId ? normalizeInteger(body.userId, "Usuario") : null,
    discountType:
      body.discountType === "PERCENTAGE" || body.discountType === "FIXED"
        ? body.discountType
        : null,
    discountValue: normalizeDecimal(body.discountValue, "Desconto da venda"),
  };
}

function deriveSaleStatusFromItems() {
  return "COMPLETED";
}

async function normalizeFinalizationPayload(body = {}, { customerId, finalAmount }) {
  const mainPaymentType = await getRequiredPaymentType(body.paymentTypeId, "Forma de pagamento");
  const installmentCount =
    body.installmentCount === null || body.installmentCount === undefined || body.installmentCount === ""
      ? Number(mainPaymentType.defaultInstallments || 1)
      : normalizeInteger(body.installmentCount, "Quantidade de parcelas");

  validateInstallmentCount(mainPaymentType, installmentCount);

  const dueDate = normalizeDate(body.dueDate, "Data de vencimento");
  if (mainPaymentType.requiresDueDate && !dueDate) {
    throw createSalesValidationError("Data de vencimento e obrigatoria.");
  }

  if (!mainPaymentType.requiresDueDate && !isCardPaymentType(mainPaymentType) && dueDate) {
    throw createSalesValidationError("A forma de pagamento selecionada nao utiliza vencimento futuro.");
  }

  const entryAmount =
    body.entryAmount === null || body.entryAmount === undefined || body.entryAmount === ""
      ? 0
      : normalizeDecimal(body.entryAmount, "Valor da entrada");

  let entryReceipt = null;
  let entryPaymentType = null;
  let financialMovement = null;

  if (entryAmount !== null && entryAmount > 0) {
    entryPaymentType = await getRequiredPaymentType(
      body.entryPaymentTypeId,
      "Forma de pagamento da entrada",
    );
    validateEntryPaymentType(mainPaymentType, entryPaymentType);

    if (entryAmount >= finalAmount) {
      throw createSalesValidationError("O valor da entrada deve ser menor que o valor final.");
    }

    entryReceipt = {
      paymentTypeId: entryPaymentType.id,
      receiptType: "ENTRY",
      amount: roundCurrency(entryAmount),
      paidAt: normalizeDate(body.entryPaidAt, "Data da entrada") || new Date(),
      referenceCode: body.entryReferenceCode ? String(body.entryReferenceCode).trim() : null,
    };

    financialMovement = buildIncomingFinancialMovement({
      paymentType: entryPaymentType,
      amount: entryReceipt.amount,
      paidAt: entryReceipt.paidAt,
      referenceCode: entryReceipt.referenceCode,
    });
  } else if (body.entryPaymentTypeId || body.entryPaidAt || body.entryReferenceCode) {
    throw createSalesValidationError("Informe um valor de entrada valido para registrar a entrada.");
  }

  if (!entryReceipt && mainPaymentType.financialFlow === "IMMEDIATE_CASH") {
    const paymentReferenceCode = body.paymentReferenceCode
      ? String(body.paymentReferenceCode).trim()
      : null;

    if (isImmediateCheckPaymentType(mainPaymentType) && !paymentReferenceCode) {
      throw createSalesValidationError("Numero do cheque e obrigatorio.");
    }

    entryReceipt = {
      paymentTypeId: mainPaymentType.id,
      receiptType: "SALE_FULL",
      amount: roundCurrency(finalAmount),
      paidAt: new Date(),
      referenceCode: paymentReferenceCode,
    };

    financialMovement = buildIncomingFinancialMovement({
      paymentType: mainPaymentType,
      amount: entryReceipt.amount,
      paidAt: entryReceipt.paidAt,
      referenceCode: entryReceipt.referenceCode,
    });
  }

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
    throw createSalesValidationError("Taxa do cartao invalida.");
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
    throw createSalesValidationError("Data prevista de repasse e obrigatoria para cartao.");
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

  return {
    mainPaymentType,
    installmentCount,
    dueDate,
    entryReceipt,
    financialMovement: financialMovement ? [financialMovement] : [],
    receivable,
    remainingAmount,
  };
}

function buildSaleResponse(created, extra = {}) {
  return {
    id: created.sale.idSale,
    customerId: created.sale.customerId,
    totalAmount: Number(created.sale.totalAmount),
    finalAmount: Number(created.sale.finalAmount),
    status: created.sale.status,
    productsCount: created.products?.length || 0,
    itemsCount: created.items?.length || created.sale.SaleItems?.length || 0,
    measurementsCount: created.measurements?.length || 0,
    entryReceiptId: created.entryReceipt?.idPaymentReceipt || null,
    receivableId: created.receivable?.receivable?.idReceivable || created.receivable?.idReceivable || null,
    ...extra,
  };
}

async function createQuote(body = {}) {
  const normalized = normalizeQuoteBase(body);

  const created = await repository.createSale({
    sale: {
      customerId: normalized.customerId,
      userId: normalized.userId,
      discountType: normalized.discountType,
      discountValue: normalized.discountValue,
      totalAmount: normalized.totalAmount,
      finalAmount: normalized.finalAmount,
      status: "BUDGET",
      dueDate: null,
      paymentTypeId: null,
      installmentCount: 1,
    },
    items: normalized.items,
    customerMeasurements: normalized.customerMeasurements,
    entryReceipt: null,
    receivable: null,
    financialMovements: [],
  });

  return buildSaleResponse(created, {
    quote: true,
  });
}

async function finalizeSale(id, body = {}) {
  const normalizedId = Number(id);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw createSalesValidationError("Venda invalida.");
  }

  const sale = await repository.getSaleForFinalization(normalizedId);

  if (!sale) {
    throw notFoundError("Venda nao encontrada.");
  }

  if (sale.status !== "BUDGET") {
    throw createSalesValidationError("Somente vendas em orcamento podem ser concluidas.");
  }

  const items = Array.isArray(sale.SaleItems) ? sale.SaleItems : [];

  if (!items.length) {
    throw createSalesValidationError("Nao foi possivel concluir um orcamento sem itens.");
  }

  if (sale.PaymentReceipts?.length || sale.Receivable) {
    throw createSalesValidationError("Este orcamento ja possui registros financeiros vinculados.");
  }

  const finalization = await normalizeFinalizationPayload(body, {
    customerId: sale.customerId,
    finalAmount: Number(sale.finalAmount || 0),
  });

  const finalStatus = deriveSaleStatusFromItems(items);

  const finalized = await repository.finalizeSale(normalizedId, {
    sale: {
      status: finalStatus,
      dueDate: finalization.dueDate || finalization.receivable?.cardTransaction?.expectedSettlementDate || null,
      paymentTypeId: finalization.mainPaymentType.id,
      installmentCount: finalization.installmentCount,
    },
    entryReceipt: finalization.entryReceipt,
    receivable: finalization.receivable,
    financialMovements: finalization.financialMovement,
  });

  if (!finalized) {
    throw notFoundError("Venda nao encontrada.");
  }

  return buildSaleResponse(finalized, {
    paymentPreview: {
      paymentTypeId: finalization.mainPaymentType.id,
      paymentTypeName: finalization.mainPaymentType.name,
      entryAmount: roundCurrency(finalization.entryReceipt?.amount || 0),
      remainingAmount: finalization.remainingAmount,
      debtorType: finalization.receivable?.debtorType || null,
      installments:
        finalization.receivable?.installments.map((installment) => ({
          installmentNumber: installment.installmentNumber,
          totalInstallments: installment.totalInstallments,
          dueDate: installment.dueDate,
          amount: installment.amount,
        })) || [],
    },
  });
}

async function finalizeSaleFromScratch(body = {}) {
  const normalized = normalizeQuoteBase(body);
  const finalization = await normalizeFinalizationPayload(body, {
    customerId: normalized.customerId,
    finalAmount: normalized.finalAmount,
  });
  const finalStatus = deriveSaleStatusFromItems(normalized.items);

  const created = await repository.createSale({
    sale: {
      customerId: normalized.customerId,
      userId: normalized.userId,
      discountType: normalized.discountType,
      discountValue: normalized.discountValue,
      totalAmount: normalized.totalAmount,
      finalAmount: normalized.finalAmount,
      status: finalStatus,
      dueDate: finalization.dueDate || finalization.receivable?.cardTransaction?.expectedSettlementDate || null,
      paymentTypeId: finalization.mainPaymentType.id,
      installmentCount: finalization.installmentCount,
    },
    items: normalized.items,
    customerMeasurements: normalized.customerMeasurements,
    entryReceipt: finalization.entryReceipt,
    receivable: finalization.receivable,
    financialMovements: finalization.financialMovement,
  });

  return buildSaleResponse(created, {
    paymentPreview: {
      paymentTypeId: finalization.mainPaymentType.id,
      paymentTypeName: finalization.mainPaymentType.name,
      entryAmount: roundCurrency(finalization.entryReceipt?.amount || 0),
      remainingAmount: finalization.remainingAmount,
      debtorType: finalization.receivable?.debtorType || null,
      installments:
        finalization.receivable?.installments.map((installment) => ({
          installmentNumber: installment.installmentNumber,
          totalInstallments: installment.totalInstallments,
          dueDate: installment.dueDate,
          amount: installment.amount,
        })) || [],
    },
  });
}

async function getSaleById(id) {
  const normalizedId = Number(id);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw createSalesValidationError("Venda invalida.");
  }

  const sale = await repository.getSaleById(normalizedId);

  if (!sale) {
    throw notFoundError("Venda nao encontrada.");
  }

  return mapSaleDetails(sale);
}

async function listSales({ page, pageSize, status, search } = {}) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.min(100, Math.max(1, Number(pageSize) || 10));
  const normalizedSearch = search ? String(search).trim() : undefined;
  const normalizedStatus = status ? String(status).trim().toUpperCase() : undefined;
  const result = await repository.listSales({
    page: normalizedPage,
    pageSize: normalizedPageSize,
    status: normalizedStatus,
    search: normalizedSearch,
  });
  const total = Number(result.count || 0);

  return {
    items: result.rows.map(mapSaleListItem),
    total,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalPages: Math.max(1, Math.ceil(total / normalizedPageSize)),
  };
}

module.exports = {
  MEASUREMENT_FIELDS,
  createSalesValidationError,
  createSale,
  createQuote,
  finalizeSale,
  getSaleById,
  listSales,
};
