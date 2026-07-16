const { notFoundError, validationError } = require("../errors/AppError");
const paymentTypesRepository = require("../repositories/paymentTypesRepository");
const repository = require("../repositories/receivablesRepository");
const {
  buildPaymentTypeResponse,
  isImmediateCashPaymentType,
} = require("../utils/paymentTypeRules");

function createReceivablesValidationError(message, statusCode = 400) {
  const error = validationError(message, {
    name: "ReceivablesValidationError",
    code: "RECEIVABLES_VALIDATION_ERROR",
  });
  error.statusCode = statusCode;
  return error;
}

function normalizeAmount(value, fieldName) {
  const normalized = Number(value);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw createReceivablesValidationError(`${fieldName} invalido.`);
  }

  return normalized;
}

function normalizeDate(value, fieldName) {
  if (!value) {
    throw createReceivablesValidationError(`${fieldName} obrigatoria.`);
  }

  const raw = String(value).trim();
  const base = raw.includes("T") ? raw.split("T")[0] : raw;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);

  if (!match) {
    throw createReceivablesValidationError(`${fieldName} invalida.`);
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
}

function getInstallmentFilter(status, dueDate, paidAmount, amount) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizedDueDate = new Date(dueDate);
  normalizedDueDate.setHours(0, 0, 0, 0);

  const openBalance = Number(amount) - Number(paidAmount);

  if (status === "PAID" || openBalance <= 0) return "RECEBIDAS";
  if (normalizedDueDate.getTime() < today.getTime()) return "ATRASADAS";
  if (normalizedDueDate.getTime() === today.getTime()) return "VENCE_HOJE";
  return "A_VENCER";
}

function getStandaloneReceiptFilter() {
  return "RECEBIDAS";
}

function formatInstallmentLabel(installmentNumber, totalInstallments) {
  const current = Number(installmentNumber) || 0;
  const total = Number(totalInstallments) || 0;

  if (current <= 0 || total <= 0) {
    return "-";
  }

  return `${current}/${total}`;
}

function isSameCalendarDay(leftValue, rightValue) {
  if (!leftValue || !rightValue) return false;

  const left = new Date(leftValue);
  const right = new Date(rightValue);

  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) {
    return false;
  }

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getDateOnlyKey(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function resolveInstallmentLabel(item) {
  const installmentNumber = Number(item.installmentNumber) || 0;
  const totalInstallments = Number(item.totalInstallments) || 0;
  const paymentType = item.PaymentType || item.PaymentTypes || null;
  const normalizedPaymentType = paymentType ? buildPaymentTypeResponse(paymentType) : null;
  const receivableCreatedAt = item.Receivable?.createdAt || null;
  const installmentDueDate = item.dueDate || null;

  if (
    installmentNumber === 1 &&
    totalInstallments === 1 &&
    normalizedPaymentType &&
    isImmediateCashPaymentType(normalizedPaymentType) &&
    isSameCalendarDay(receivableCreatedAt, installmentDueDate)
  ) {
    return "A VISTA";
  }

  return formatInstallmentLabel(installmentNumber, totalInstallments);
}

function annotateLegacyMixedPaymentLabels(items) {
  const groups = new Map();

  items.forEach((item) => {
    const createdDateKey = getDateOnlyKey(item.receivableCreatedAt);
    const customerKey = Number(item.customerId) || 0;

    if (!customerKey || !createdDateKey) {
      return;
    }

    const groupKey = `${customerKey}|${createdDateKey}`;
    const current = groups.get(groupKey) || [];
    current.push(item);
    groups.set(groupKey, current);
  });

  groups.forEach((groupItems) => {
    const immediateItems = groupItems.filter((item) => {
      if (Number(item.installmentNumber) !== 1 || Number(item.totalInstallments) !== 1) {
        return false;
      }

      if (!item.paymentFlow || item.paymentFlow !== "IMMEDIATE_CASH") {
        return false;
      }

      return isSameCalendarDay(item.receivableCreatedAt, item.dueDate);
    });

    const futureItems = groupItems.filter((item) => {
      if (!item.paymentFlow || item.paymentFlow !== "FUTURE_CUSTOMER") {
        return false;
      }

      return !isSameCalendarDay(item.receivableCreatedAt, item.dueDate);
    });

    if (!immediateItems.length || !futureItems.length) {
      return;
    }

    immediateItems.forEach((item) => {
      item.parcela = "ENTRADA";
    });
  });

  return items;
}

function resolveReceivableOrigin({ debtorType, operatorLabel, supplier, customer }) {
  const supplierName = supplier?.tradeName || supplier?.fullName || null;
  const customerName = customer?.fullName || customer?.companyName || null;

  if (debtorType === "CARD_OPERATOR") {
    return {
      originType: "CARD_OPERATOR",
      originName: operatorLabel || "Operadora",
      supplierName,
      customerName,
    };
  }

  if (supplierName) {
    return {
      originType: "SUPPLIER",
      originName: supplierName,
      supplierName,
      customerName,
    };
  }

  return {
    originType: "CUSTOMER",
    originName: customerName || "Cliente",
    supplierName,
    customerName,
  };
}

function normalizeOptionalDate(value, fieldName, options = {}) {
  if (!value) return null;

  const raw = String(value).trim();
  const base = raw.includes("T") ? raw.split("T")[0] : raw;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);

  if (!match) {
    throw createReceivablesValidationError(`${fieldName} invalida.`);
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

function normalizePositiveInteger(value, fieldName) {
  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw createReceivablesValidationError(`${fieldName} invalido.`);
  }

  return normalized;
}

function normalizeBoolean(value) {
  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }

  return false;
}

function getReceivableUserId(user) {
  const normalized = Number(user?.id ?? user?.idUser);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function ensureReceivableCanBeManaged(installment) {
  if (!installment || !installment.Receivable) {
    throw notFoundError("Parcela nao encontrada.");
  }

  if (installment.idReceivableInstallment <= 0) {
    throw createReceivablesValidationError("Somente contas manuais podem ser alteradas ou excluidas.");
  }

  if (installment.Receivable.saleId) {
    throw createReceivablesValidationError("Contas vinculadas a venda nao podem ser alteradas ou excluidas.");
  }

  const receiptsCount = Array.isArray(installment.PaymentReceipts)
    ? installment.PaymentReceipts.length
    : 0;

  if (receiptsCount > 0 || Number(installment.paidAmount || 0) > 0) {
    throw createReceivablesValidationError(
      "A conta a receber so pode ser alterada ou excluida antes da quitacao.",
    );
  }
}

async function listInstallments({
  status,
  customerId,
  page: rawPage,
  pageSize: rawPageSize,
  startDate: rawStartDate,
  endDate: rawEndDate,
  search: rawSearch,
} = {}) {
  const page = Math.max(1, Number(rawPage) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(rawPageSize) || 10));
  const startDate = normalizeOptionalDate(rawStartDate, "Data inicial");
  const endDate = normalizeOptionalDate(rawEndDate, "Data final", { endOfDay: true });
  const search = rawSearch ? String(rawSearch).trim() : undefined;
  const includeStandaloneReceipts = status === "RECEBIDAS" || status === "TODAS";
  const installmentsPageSize = includeStandaloneReceipts ? undefined : pageSize;
  const installmentsPage = includeStandaloneReceipts ? undefined : page;
  const result = await repository.listInstallments({
    page: installmentsPage,
    pageSize: installmentsPageSize,
    startDate,
    endDate,
    search,
    status,
    customerId,
  });
  const summary = await repository.summarizeInstallments({
    startDate,
    endDate,
    search,
    status,
    customerId,
  });

  const installmentItems = result.rows
    .map((item) => {
      const customer = item.Receivable?.Customer || item.Receivable?.Customers || null;
      const supplier = item.Receivable?.Supplier || item.Receivable?.Suppliers || null;
      const debtorType = item.Receivable?.debtorType || "CUSTOMER";
      const operatorLabel =
        item.Receivable?.operatorLabel || item.Receivable?.CardTransaction?.operatorLabel || null;
      const paymentType = item.PaymentType || item.PaymentTypes || null;
      const origin = resolveReceivableOrigin({
        debtorType,
        operatorLabel,
        supplier,
        customer,
      });
      const filter = getInstallmentFilter(
        item.status,
        item.dueDate,
        item.paidAmount,
        item.amount,
      );
      const openBalance =
        item.status === "PAID"
          ? 0
          : Math.max(0, Number(item.amount) - Number(item.paidAmount));
      const normalizedPaymentType = paymentType ? buildPaymentTypeResponse(paymentType) : null;

      return {
        id: item.idReceivableInstallment,
        receivableId: item.receivableId,
        saleId: item.Receivable?.Sale?.idSale || null,
        receivableCreatedAt: item.Receivable?.createdAt || null,
        customerId: customer?.idCustomer || null,
        supplierId: supplier?.idSupplier || item.Receivable?.supplierId || null,
        debtorType,
        operatorLabel,
        customerName: origin.originName,
        supplierName: origin.supplierName,
        originType: origin.originType,
        originName: origin.originName,
        parcela: resolveInstallmentLabel(item),
        installmentNumber: item.installmentNumber,
        totalInstallments: item.totalInstallments,
        interestBaseDate: item.interestBaseDate || item.dueDate,
        dueDate: item.dueDate,
        status: item.status,
        filter,
        paymentTypeId: paymentType?.idPaymentType || item.paymentTypeId || null,
        paymentTypeName: paymentType?.desc || null,
        paymentFlow: normalizedPaymentType?.financialFlow || null,
        amount: Number(item.amount),
        paidAmount: Number(item.paidAmount),
        openAmount: openBalance,
      };
    });
  annotateLegacyMixedPaymentLabels(installmentItems);
  const standaloneReceipts = includeStandaloneReceipts
    ? await repository.listStandaloneReceipts({
        startDate,
        endDate,
        search,
        customerId,
      })
    : [];
  const standaloneSummary = includeStandaloneReceipts
    ? await repository.summarizeStandaloneReceipts({
        startDate,
        endDate,
        search,
        customerId,
      })
    : { totalReceived: 0 };

  const standaloneItems = standaloneReceipts.map((receipt) => {
    const sale = receipt.Sale || receipt.Sales || null;
    const customer = sale?.Customer || sale?.Customers || null;
    const paymentType = receipt.PaymentType || receipt.PaymentTypes || null;

    return {
      id: -Number(receipt.idPaymentReceipt),
      receivableId: null,
      saleId: sale?.idSale || receipt.saleId || null,
      customerId: customer?.idCustomer || sale?.customerId || null,
      supplierId: null,
      debtorType: "CUSTOMER",
      operatorLabel: null,
      customerName: customer?.fullName || customer?.companyName || "Cliente",
      supplierName: null,
      originType: "CUSTOMER",
      originName: customer?.fullName || customer?.companyName || "Cliente",
      parcela: receipt.receiptType === "ENTRY" ? "ENTRADA" : "A VISTA",
      installmentNumber: null,
      totalInstallments: null,
      dueDate: receipt.paidAt,
      status: "PAID",
      filter: getStandaloneReceiptFilter(),
      paymentTypeId: paymentType?.idPaymentType || receipt.paymentTypeId || null,
      paymentTypeName: paymentType?.desc || null,
      amount: Number(receipt.amount || 0),
      paidAmount: Number(receipt.amount || 0),
      openAmount: 0,
    };
  });

  const items = includeStandaloneReceipts
    ? [...installmentItems, ...standaloneItems]
        .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
        .slice((page - 1) * pageSize, page * pageSize)
    : installmentItems;

  const total = includeStandaloneReceipts
    ? installmentItems.length + standaloneItems.length
    : Number(result.count || 0);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    summary: {
      totalOpen: Number(Number(summary.totalOpen || 0).toFixed(2)),
      totalReceived: Number(
        Number((summary.totalReceived || 0) + (standaloneSummary.totalReceived || 0)).toFixed(2),
      ),
    },
  };
}

async function registerReceipt(installmentId, body = {}) {
  const normalizedInstallmentId = Number(installmentId);

  if (!Number.isInteger(normalizedInstallmentId) || normalizedInstallmentId <= 0) {
    throw createReceivablesValidationError("Parcela invalida.");
  }

  const paymentTypeId = Number(body.paymentTypeId);
  if (!Number.isInteger(paymentTypeId) || paymentTypeId <= 0) {
    throw createReceivablesValidationError("Forma de pagamento invalida.");
  }

  const paymentType = await paymentTypesRepository.getPaymentTypeById(paymentTypeId);
  if (!paymentType) {
    throw createReceivablesValidationError("Forma de pagamento invalida.");
  }

  const normalizedPaymentType = buildPaymentTypeResponse(paymentType);
  const amount = normalizeAmount(body.amount, "Valor recebido");
  const paidAt = normalizeDate(body.paidAt, "Data de recebimento");
  const referenceCode = body.referenceCode ? String(body.referenceCode).trim() : null;
  const discardInterest = normalizeBoolean(body.discardInterest);

  const created = await repository.registerReceipt(normalizedInstallmentId, {
    paymentTypeId,
    amount,
    paidAt,
    referenceCode,
    discardInterest,
    financialMovement: {
      target: isImmediateCashPaymentType(normalizedPaymentType) ? "CASH" : "BANK",
      scope: "LOJA",
      movementType: "IN",
      category: "RECEBIMENTO",
      description: `Recebimento de parcela via ${normalizedPaymentType.name}`,
      accountLabel: "Banco da Loja",
      amount,
      occurredAt: paidAt,
      paymentTypeId,
      referenceCode,
      sourceType: "RECEIVABLE_RECEIPT",
    },
  });

  if (created === undefined) {
    throw notFoundError("Parcela nao encontrada.");
  }

  return {
    message: "Recebimento registrado com sucesso.",
    receiptId: created.receipt.idPaymentReceipt,
  };
}

async function createReceivable(body = {}) {
  const customerId = normalizePositiveInteger(body.customerId, "Cliente");
  const paymentTypeId = normalizePositiveInteger(body.paymentTypeId, "Forma de pagamento");
  const amount = normalizeAmount(body.amount, "Valor");
  const dueDate = normalizeDate(body.dueDate, "Data de vencimento");

  const [customer, paymentType] = await Promise.all([
    repository.getCustomerById(customerId),
    paymentTypesRepository.getPaymentTypeById(paymentTypeId),
  ]);

  if (!customer) {
    throw createReceivablesValidationError("Cliente invalido.");
  }

  if (!paymentType) {
    throw createReceivablesValidationError("Forma de pagamento invalida.");
  }

  const created = await repository.createManualReceivable({
    customerId,
    paymentTypeId,
    amount,
    dueDate,
  });

  return {
    id: created.installment.idReceivableInstallment,
    message: "Conta a receber criada com sucesso.",
  };
}

async function updateReceivable(installmentId, body = {}) {
  const normalizedInstallmentId = normalizePositiveInteger(installmentId, "Parcela");
  const installment = await repository.getInstallmentById(normalizedInstallmentId);

  ensureReceivableCanBeManaged(installment);

  const customerId = normalizePositiveInteger(body.customerId, "Cliente");
  const paymentTypeId = normalizePositiveInteger(body.paymentTypeId, "Forma de pagamento");
  const amount = normalizeAmount(body.amount, "Valor");
  const dueDate = normalizeDate(body.dueDate, "Data de vencimento");

  const [customer, paymentType] = await Promise.all([
    repository.getCustomerById(customerId),
    paymentTypesRepository.getPaymentTypeById(paymentTypeId),
  ]);

  if (!customer) {
    throw createReceivablesValidationError("Cliente invalido.");
  }

  if (!paymentType) {
    throw createReceivablesValidationError("Forma de pagamento invalida.");
  }

  await repository.updateManualReceivable(normalizedInstallmentId, {
    customerId,
    paymentTypeId,
    amount,
    dueDate,
  });

  return {
    message: "Conta a receber alterada com sucesso.",
  };
}

async function deleteReceivable(installmentId, user) {
  const normalizedInstallmentId = normalizePositiveInteger(installmentId, "Parcela");
  const installment = await repository.getInstallmentById(normalizedInstallmentId);

  ensureReceivableCanBeManaged(installment);

  const customerName =
    installment.Receivable?.Customer?.fullName ||
    installment.Receivable?.Customer?.companyName ||
    "Cliente";
  const amount = Number(installment.amount || 0).toFixed(2);
  const dueDate = installment.dueDate
    ? new Date(installment.dueDate).toISOString().slice(0, 10)
    : "-";

  await repository.deleteManualReceivable(normalizedInstallmentId, {
    auditTypeId: 1,
    userId: getReceivableUserId(user),
    occurredAt: new Date(),
    history: `Exclusao de conta a receber ${normalizedInstallmentId} do cliente ${customerName} no valor de ${amount} com vencimento em ${dueDate}.`,
    reason: null,
  });

  return {
    message: "Conta a receber excluida com sucesso.",
  };
}

module.exports = {
  createReceivablesValidationError,
  listInstallments,
  createReceivable,
  updateReceivable,
  deleteReceivable,
  registerReceipt,
};
