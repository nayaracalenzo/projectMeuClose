const { notFoundError, validationError } = require("../errors/AppError");
const repository = require("../repositories/receivablesRepository");

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

async function listInstallments({ status, customerId }) {
  const installments = await repository.listInstallments();

  return installments
    .map((item) => {
      const customer = item.Receivable?.Customer || item.Receivable?.Customers || null;
      const debtorType = item.Receivable?.debtorType || "CUSTOMER";
      const operatorLabel =
        item.Receivable?.operatorLabel || item.Receivable?.CardTransaction?.operatorLabel || null;
      const paymentType = item.PaymentType || item.PaymentTypes || null;
      const customerName =
        debtorType === "CARD_OPERATOR"
          ? operatorLabel || "Operadora"
          : customer?.fullName || customer?.companyName || "Cliente";
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
        debtorType,
        operatorLabel,
        customerName,
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
    })
    .filter((item) => {
      const matchesCustomer = customerId ? Number(item.customerId) === Number(customerId) : true;
      const matchesStatus =
        !status || status === "TODAS"
          ? true
          : status === "A_RECEBER"
            ? item.status !== "PAID"
            : item.filter === status;
      return matchesCustomer && matchesStatus;
    });
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

  const created = await repository.registerReceipt(normalizedInstallmentId, {
    paymentTypeId,
    amount: normalizeAmount(body.amount, "Valor recebido"),
    paidAt: normalizeDate(body.paidAt, "Data de recebimento"),
    referenceCode: body.referenceCode ? String(body.referenceCode).trim() : null,
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
