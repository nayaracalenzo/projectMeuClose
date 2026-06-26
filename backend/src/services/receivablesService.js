const repository = require("../repositories/receivablesRepository");

class ReceivablesValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ReceivablesValidationError";
    this.statusCode = statusCode;
  }
}

function normalizeAmount(value, fieldName) {
  const normalized = Number(value);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new ReceivablesValidationError(`${fieldName} invalido.`);
  }

  return normalized;
}

function normalizeDate(value, fieldName) {
  if (!value) {
    throw new ReceivablesValidationError(`${fieldName} obrigatoria.`);
  }

  const raw = String(value).trim();
  const base = raw.includes("T") ? raw.split("T")[0] : raw;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);

  if (!match) {
    throw new ReceivablesValidationError(`${fieldName} invalida.`);
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
        item.amount
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
          item.totalInstallments
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
    throw new ReceivablesValidationError("Parcela invalida.");
  }

  const paymentTypeId = Number(body.paymentTypeId);
  if (!Number.isInteger(paymentTypeId) || paymentTypeId <= 0) {
    throw new ReceivablesValidationError("Forma de pagamento invalida.");
  }

  const created = await repository.registerReceipt(normalizedInstallmentId, {
    paymentTypeId,
    amount: normalizeAmount(body.amount, "Valor recebido"),
    paidAt: normalizeDate(body.paidAt, "Data de recebimento"),
    referenceCode: body.referenceCode ? String(body.referenceCode).trim() : null,
  });

  if (created === undefined) {
    throw new ReceivablesValidationError("Parcela nao encontrada.", 404);
  }

  return {
    message: "Recebimento registrado com sucesso.",
    receiptId: created.receipt.idPaymentReceipt,
  };
}

module.exports = {
  ReceivablesValidationError,
  listInstallments,
  registerReceipt,
};
