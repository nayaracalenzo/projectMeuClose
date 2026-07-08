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
  const result = await repository.listInstallments({
    page,
    pageSize,
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

  const items = result.rows
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
      const openBalance = Math.max(0, Number(item.amount) - Number(item.paidAmount));

      return {
        id: item.idReceivableInstallment,
        receivableId: item.receivableId,
        saleId: item.Receivable?.Sale?.idSale || null,
        customerId: customer?.idCustomer || null,
        supplierId: supplier?.idSupplier || item.Receivable?.supplierId || null,
        debtorType,
        operatorLabel,
        customerName: origin.originName,
        supplierName: origin.supplierName,
        originType: origin.originType,
        originName: origin.originName,
        parcela: `${String(item.installmentNumber).padStart(3, "0")}/${String(
          item.totalInstallments,
        ).padStart(3, "0")}`,
        installmentNumber: item.installmentNumber,
        totalInstallments: item.totalInstallments,
        dueDate: item.dueDate,
        status: item.status,
        filter,
        paymentTypeId: paymentType?.idPaymentType || item.paymentTypeId || null,
        paymentTypeName: paymentType?.desc || null,
        amount: Number(item.amount),
        paidAmount: Number(item.paidAmount),
        openAmount: openBalance,
      };
    });

  const total = Number(result.count || 0);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    summary: {
      totalOpen: Number(Number(summary.totalOpen || 0).toFixed(2)),
      totalReceived: Number(Number(summary.totalReceived || 0).toFixed(2)),
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

  const created = await repository.registerReceipt(normalizedInstallmentId, {
    paymentTypeId,
    amount,
    paidAt,
    referenceCode,
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

module.exports = {
  createReceivablesValidationError,
  listInstallments,
  registerReceipt,
};
