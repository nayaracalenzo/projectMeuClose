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

function normalizeOptionalDate(value, fieldName, options = {}) {
  if (!value) {
    return null;
  }

  const base = String(value).trim().split("T")[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) {
    throw createPayablesValidationError(`${fieldName} invalida.`);
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

function deriveFilter(status, dueDate, openAmount, amount) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizedDueDate = new Date(dueDate);
  normalizedDueDate.setHours(0, 0, 0, 0);

  if (status === "PAID" || Number(openAmount) <= 0) return "PAGAS";
  if (normalizedDueDate.getTime() < today.getTime()) return "ATRASADAS";
  if (normalizedDueDate.getTime() === today.getTime()) return "VENCE_HOJE";
  return "A_VENCER";
}

async function listPayables({
  status,
  scope,
  search: rawSearch,
  page: rawPage,
  pageSize: rawPageSize,
  startDate: rawStartDate,
  endDate: rawEndDate,
} = {}) {
  const page = Math.max(1, Number(rawPage) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(rawPageSize) || 10));
  const startDate = normalizeOptionalDate(rawStartDate, "Data inicial");
  const endDate = normalizeOptionalDate(rawEndDate, "Data final", { endOfDay: true });
  const search = rawSearch ? String(rawSearch).trim() : undefined;
  const result = await repository.listPayables({
    status,
    scope,
    search,
    page,
    pageSize,
    startDate,
    endDate,
  });
  const summary = await repository.summarizePayables({
    status,
    scope,
    search,
    startDate,
    endDate,
  });

  const items = result.rows.map((item) => {
    const supplier = item.Supplier || item.Suppliers || null;
    const paymentType = item.PaymentType || item.PaymentTypes || null;
    const supplierName = supplier?.tradeName || supplier?.fullName || null;

    return {
      id: item.idPayable,
      scope: item.scope,
      description: item.description,
      category: item.category,
      beneficiary: supplierName || item.beneficiary,
      supplierId: supplier?.idSupplier || item.supplierId || null,
      supplierName,
      amount: Number(item.amount),
      openAmount: Number(item.openAmount),
      paidAmount: Math.max(0, Number(item.amount) - Number(item.openAmount)),
      dueDate: item.dueDate,
      status: item.status,
      settlementTarget: item.settlementTarget,
      accountLabel: item.accountLabel,
      plannedPaymentTypeId:
        paymentType?.idPaymentType || item.plannedPaymentTypeId || null,
      plannedPaymentTypeName: paymentType?.desc || null,
      filter: deriveFilter(item.status, item.dueDate, item.openAmount, item.amount),
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
      totalAmount: Number(Number(summary.totalAmount || 0).toFixed(2)),
      totalOpen: Number(Number(summary.totalOpen || 0).toFixed(2)),
    },
  };
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
  const rawBeneficiary = String(body.beneficiary || "").trim();
  const supplierId = body.supplierId ? Number(body.supplierId) : null;
  const supplier =
    Number.isInteger(supplierId) && supplierId > 0
      ? await repository.getSupplierById(supplierId)
      : null;
  const beneficiary = supplier?.tradeName || supplier?.fullName || rawBeneficiary;

  if (!description || !category || !beneficiary) {
    throw createPayablesValidationError("Descrição, categoria e favorecido sao obrigatórios.");
  }

  const amount = normalizeAmount(body.amount, "Valor");

  const created = await repository.createPayable({
    scope,
    description,
    category,
    beneficiary,
    supplierId: supplier?.idSupplier || null,
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

  const payable = await repository.getPayableById(normalizedPayableId);
  if (!payable) {
    throw notFoundError("Conta a pagar nao encontrada.");
  }

  const amount = normalizeAmount(body.amount, "Valor pago");
  const currentOpenAmount = Number(payable.openAmount || 0);
  if (amount > currentOpenAmount) {
    throw createPayablesValidationError("Valor pago nao pode ser maior que o saldo em aberto.");
  }
  const paidAt = normalizeDate(body.paidAt, "Data do pagamento");
  const referenceCode = body.referenceCode ? String(body.referenceCode).trim() : null;

  const created = await repository.registerPayment(normalizedPayableId, {
    paymentTypeId,
    amount,
    paidAt,
    referenceCode,
    financialMovement: {
      target: payable.settlementTarget,
      scope: payable.scope,
      movementType: "OUT",
      category: payable.category || "PAGAMENTO",
      description: payable.description || `Pagamento a ${payable.beneficiary}`,
      accountLabel: payable.accountLabel || "Banco da Loja",
      amount,
      occurredAt: paidAt,
      paymentTypeId,
      referenceCode,
      sourceType: "PAYABLE_PAYMENT",
    },
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
