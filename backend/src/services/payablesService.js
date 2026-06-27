const { notFoundError, validationError } = require("../errors/AppError");
const repository = require("../repositories/payablesRepository");

function createPayablesValidationError(message, statusCode = 400) {
  const error = validationError(message, {
    name: "PayablesValidationError",
    code: "PAYABLES_VALIDATION_ERROR",
  });
  error.statusCode = statusCode;
  return error;
}

function normalizeAmount(value, fieldName) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw createPayablesValidationError(`${fieldName} invalido.`);
  }
  return normalized;
}

function normalizeDate(value, fieldName) {
  if (!value) {
    throw createPayablesValidationError(`${fieldName} obrigatoria.`);
  }

  const base = String(value).trim().split("T")[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) {
    throw createPayablesValidationError(`${fieldName} invalida.`);
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
}

function deriveFilter(status, dueDate, openAmount) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizedDueDate = new Date(dueDate);
  normalizedDueDate.setHours(0, 0, 0, 0);

  if (status === "PAID" || Number(openAmount) === 0) return "PAGAS";
  if (normalizedDueDate.getTime() < today.getTime()) return "ATRASADAS";
  if (normalizedDueDate.getTime() === today.getTime()) return "VENCE_HOJE";
  return "A_VENCER";
}

async function listPayables({ status, scope }) {
  const payables = await repository.listPayables();

  return payables
    .map((item) => {
      const paymentType = item.PaymentType || item.PaymentTypes || null;

      return {
        id: item.idPayable,
        scope: item.scope,
        description: item.description,
        category: item.category,
        beneficiary: item.beneficiary,
        amount: Number(item.amount),
        openAmount: Number(item.openAmount),
        dueDate: item.dueDate,
        status: item.status,
        settlementTarget: item.settlementTarget,
        accountLabel: item.accountLabel,
        plannedPaymentTypeId:
          paymentType?.idPaymentType || item.plannedPaymentTypeId || null,
        plannedPaymentTypeName: paymentType?.desc || null,
        filter: deriveFilter(item.status, item.dueDate, item.openAmount),
      };
    })
    .filter((item) => {
      const matchesScope = scope ? item.scope === scope : true;
      const matchesStatus =
        !status || status === "TODAS"
          ? true
          : status === "EM_ABERTO"
            ? item.status !== "PAID"
            : item.filter === status;
      return matchesScope && matchesStatus;
    });
}

async function createPayable(body = {}) {
  const scope = String(body.scope || "").trim();
  if (scope !== "LOJA" && scope !== "PESSOAL") {
    throw createPayablesValidationError("Escopo invalido.");
  }

  const settlementTarget = String(body.settlementTarget || "").trim();
  if (settlementTarget !== "BANCO" && settlementTarget !== "CAIXA") {
    throw createPayablesValidationError("Destino previsto invalido.");
  }

  const description = String(body.description || "").trim();
  const category = String(body.category || "").trim();
  const beneficiary = String(body.beneficiary || "").trim();

  if (!description || !category || !beneficiary) {
    throw createPayablesValidationError("Descricao, categoria e favorecido sao obrigatorios.");
  }

  const amount = normalizeAmount(body.amount, "Valor");

  const created = await repository.createPayable({
    scope,
    description,
    category,
    beneficiary,
    amount,
    openAmount: amount,
    dueDate: normalizeDate(body.dueDate, "Data de vencimento"),
    status: "OPEN",
    settlementTarget,
    accountLabel: body.accountLabel ? String(body.accountLabel).trim() : null,
    plannedPaymentTypeId: body.plannedPaymentTypeId ? Number(body.plannedPaymentTypeId) : null,
  });

  return {
    id: created.idPayable,
    message: "Conta a pagar criada com sucesso.",
  };
}

async function registerPayment(payableId, body = {}) {
  const normalizedPayableId = Number(payableId);
  if (!Number.isInteger(normalizedPayableId) || normalizedPayableId <= 0) {
    throw createPayablesValidationError("Conta a pagar invalida.");
  }

  const paymentTypeId = Number(body.paymentTypeId);
  if (!Number.isInteger(paymentTypeId) || paymentTypeId <= 0) {
    throw createPayablesValidationError("Forma de pagamento invalida.");
  }

  const created = await repository.registerPayment(normalizedPayableId, {
    paymentTypeId,
    amount: normalizeAmount(body.amount, "Valor pago"),
    paidAt: normalizeDate(body.paidAt, "Data do pagamento"),
    referenceCode: body.referenceCode ? String(body.referenceCode).trim() : null,
  });

  if (created === undefined) {
    throw notFoundError("Conta a pagar nao encontrada.");
  }

  return {
    message: "Pagamento registrado com sucesso.",
    paymentId: created.payment.idPayablePayment,
  };
}

module.exports = {
  createPayablesValidationError,
  listPayables,
  createPayable,
  registerPayment,
};
