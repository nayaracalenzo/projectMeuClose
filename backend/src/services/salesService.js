const { notFoundError, validationError } = require("../errors/AppError");
const { sequelize } = require("../models");
const repository = require("../repositories/salesRepository");
const auditsRepository = require("../repositories/auditsRepository");
const bankRepository = require("../repositories/bankRepository");
const cashRepository = require("../repositories/cashRepository");
const cashSessionsRepository = require("../repositories/cashSessionsRepository");
const customerCreditsRepository = require("../repositories/customerCreditsRepository");
const financialAccountsRepository = require("../repositories/financialAccountsRepository");
const paymentTypesRepository = require("../repositories/paymentTypesRepository");
const { createBankEntry, createCashEntry } = require("./financialEntriesService");
const {
  buildPaymentTypeResponse,
  isCardPaymentType,
  isImmediateCashPaymentType,
  isImmediateCheckPaymentType,
  isImmediateEntryPaymentType,
} = require("../utils/paymentTypeRules");
const {
  LEGACY_MEASUREMENT_DEFINITIONS,
} = require("../utils/measurementDefinitions");

const MEASUREMENT_FIELDS = LEGACY_MEASUREMENT_DEFINITIONS.map((item) => item.key);
const MEASUREMENT_DEFINITION_BY_KEY = new Map(
  LEGACY_MEASUREMENT_DEFINITIONS.map((item) => [item.key, item]),
);

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

function normalizeRequiredText(value, fieldName) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw createSalesValidationError(`${fieldName} obrigatorio.`);
  }

  return normalized;
}

function normalizeOptionalText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeUserId(user) {
  const normalized = Number(user?.id ?? user?.idUser);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
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

function buildSaleCancellationAuditHistory(sale, occurredAt) {
  return `CANCELAMENTO da venda ${sale.idSale} em ${new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(occurredAt)}.`;
}

function buildSaleItemCancellationAuditHistory(saleId, item, occurredAt) {
  return `CANCELAMENTO PARCIAL da venda ${saleId}, item ${item.idSaleItem}, em ${new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(occurredAt)}.`;
}

function buildCustomerCreditDescription(saleId, itemDescription) {
  const resolvedDescription = String(itemDescription || "").trim() || "Item da venda";
  return `Credito gerado no cancelamento da peca da venda ${saleId} - ${resolvedDescription}`;
}

function buildCustomerCreditReceiptReference() {
  return "USO DE CREDITO DA CLIENTE";
}

function isPreviousDay(dateValue) {
  if (!dateValue) return false;

  const openedAt = new Date(dateValue);
  const openedDay = new Date(openedAt);
  openedDay.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return openedDay.getTime() < today.getTime();
}

async function ensureOpenStoreCashSessionForSaleFinalization() {
  const openSession = await cashSessionsRepository.findOpenStoreSession();

  if (!openSession) {
    throw createSalesValidationError("Abra o caixa da loja antes de registrar a venda.");
  }

  if (isPreviousDay(openSession.openedAt)) {
    throw createSalesValidationError(
      "Existe um caixa da loja aberto de dia anterior. Feche o caixa antes de continuar.",
    );
  }
}

async function resolveCustomerCreditApplication(body = {}, customerId, finalAmount, transaction) {
  const shouldUseCredit = Boolean(body.useCustomerCredit);
  const requestedAmount =
    body.customerCreditAmount === null ||
    body.customerCreditAmount === undefined ||
    body.customerCreditAmount === ""
      ? 0
      : normalizeDecimal(body.customerCreditAmount, "Valor do credito");

  if (!shouldUseCredit) {
    if (requestedAmount > 0) {
      throw createSalesValidationError(
        "Marque a opcao de usar credito para aplicar saldo da cliente nesta venda.",
      );
    }

    return {
      amount: 0,
      receipt: null,
      usages: [],
    };
  }

  if (requestedAmount <= 0) {
    throw createSalesValidationError("Informe um valor de credito maior que zero.");
  }

  if (requestedAmount >= finalAmount) {
    throw createSalesValidationError("O valor do credito deve ser menor que o valor final da venda.");
  }

  const credits = await customerCreditsRepository.listActiveCreditsByCustomerId(customerId, transaction);
  const availableAmount = roundCurrency(
    credits.reduce((acc, item) => acc + Number(item.balanceAmount || 0), 0),
  );

  if (availableAmount <= 0) {
    throw createSalesValidationError("A cliente nao possui credito disponivel.");
  }

  if (requestedAmount > availableAmount) {
    throw createSalesValidationError("O valor informado excede o credito disponivel da cliente.");
  }

  let remaining = roundCurrency(requestedAmount);
  const usages = [];

  for (const credit of credits) {
    if (remaining <= 0) {
      break;
    }

    const currentBalance = Number(credit.balanceAmount || 0);
    if (currentBalance <= 0) {
      continue;
    }

    const usedAmount = roundCurrency(Math.min(currentBalance, remaining));
    remaining = roundCurrency(remaining - usedAmount);

    usages.push({
      customerCreditId: credit.idCustomerCredit,
      amount: usedAmount,
      nextBalanceAmount: roundCurrency(currentBalance - usedAmount),
      nextStatus: roundCurrency(currentBalance - usedAmount) > 0 ? "ACTIVE" : "USED",
    });
  }

  if (remaining > 0) {
    throw createSalesValidationError("Nao foi possivel reservar o credito informado para esta venda.");
  }

  return {
    amount: roundCurrency(requestedAmount),
    receipt: {
      paymentTypeId: null,
      receiptType: "CUSTOMER_CREDIT",
      amount: roundCurrency(requestedAmount),
      paidAt: new Date(),
      referenceCode: buildCustomerCreditReceiptReference(),
    },
    usages,
  };
}

function buildFinancialReversalHistory(kind, scope, entryId, amount, description, occurredAt) {
  const placeLabel =
    kind === "CASH"
      ? scope === "LOJA"
        ? "CAIXA"
        : "CAIXA PESSOAL"
      : scope === "LOJA"
        ? "BANCO"
        : "BANCO PESSOAL";

  return `EXTORNO de ${placeLabel} do lancamento ${entryId} em ${new Intl.DateTimeFormat(
    "pt-BR",
  ).format(occurredAt)}, valor ${Number(amount || 0).toFixed(2)}, descricao ${description}.`;
}

function isReversalDescription(description) {
  return String(description || "").trim().toUpperCase().startsWith("ESTORNO - ");
}

function isCancelledSaleItem(item) {
  return Boolean(item?.metadata?.cancellation?.cancelledAt);
}

function normalizeFinancialResolution(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "REFUND" || normalized === "APPLY_REMAINING" || normalized === "CREDIT") {
    return normalized;
  }

  throw createSalesValidationError("Resolucao financeira invalida.");
}

function resolveInstallmentStatusByDueDate(dueDate) {
  if (!dueDate) {
    return "OPEN";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizedDueDate = new Date(dueDate);
  normalizedDueDate.setHours(0, 0, 0, 0);

  return normalizedDueDate.getTime() < today.getTime() ? "OVERDUE" : "OPEN";
}

async function reverseSaleCashEntries(saleId, occurredAt, reason, userId, transaction) {
  const entries = await cashRepository.listEntriesBySaleId(saleId, transaction);
  let reversedCount = 0;

  for (const entry of entries) {
    if (entry.reversalOfCashEntryId || isReversalDescription(entry.description)) {
      continue;
    }

    const existingReversal = await cashRepository.findReversalByOriginId(entry.idCashEntry, transaction);

    if (existingReversal) {
      continue;
    }

    const categoryDescription = entry.FinancialCategory?.description || entry.category;

    await createCashEntry(
      {
        scope: entry.scope,
        movementType: entry.movementType === "IN" ? "OUT" : "IN",
        financialCategoryId: entry.financialCategoryId || null,
        category: categoryDescription,
        description: `ESTORNO - ${entry.description}`,
        amount: Number(entry.amount),
        occurredAt,
        sourceType: "MANUAL",
        saleId,
        paymentReceiptId: entry.paymentReceiptId || null,
        paymentTypeId: entry.paymentTypeId || null,
        referenceCode: entry.referenceCode || null,
        transferKey: entry.transferKey || null,
        reversalOfCashEntryId: entry.idCashEntry,
      },
      transaction,
    );

    await auditsRepository.createAudit(
      {
        auditTypeId: 3,
        userId,
        occurredAt,
        history: buildFinancialReversalHistory(
          "CASH",
          entry.scope,
          entry.idCashEntry,
          entry.amount,
          entry.description,
          occurredAt,
        ),
        reason,
      },
      transaction,
    );

    reversedCount += 1;
  }

  return reversedCount;
}

async function reverseSaleBankEntries(saleId, occurredAt, reason, userId, transaction) {
  const entries = await bankRepository.listEntriesBySaleId(saleId, transaction);
  let reversedCount = 0;

  for (const entry of entries) {
    if (entry.reversalOfBankEntryId || isReversalDescription(entry.description)) {
      continue;
    }

    const existingReversal = await bankRepository.findReversalByOriginId(entry.idBankEntry, transaction);

    if (existingReversal) {
      continue;
    }

    const categoryDescription = entry.FinancialCategory?.description || entry.category;

    await createBankEntry(
      {
        scope: entry.scope,
        movementType: entry.movementType === "IN" ? "OUT" : "IN",
        financialCategoryId: entry.financialCategoryId || null,
        category: categoryDescription,
        description: `ESTORNO - ${entry.description}`,
        accountLabel: entry.accountLabel || "Banco da Loja",
        amount: Number(entry.amount),
        occurredAt,
        sourceType: "MANUAL",
        saleId,
        paymentReceiptId: entry.paymentReceiptId || null,
        paymentTypeId: entry.paymentTypeId || null,
        referenceCode: entry.referenceCode || null,
        transferKey: entry.transferKey || null,
        reversalOfBankEntryId: entry.idBankEntry,
      },
      transaction,
    );

    await auditsRepository.createAudit(
      {
        auditTypeId: 4,
        userId,
        occurredAt,
        history: buildFinancialReversalHistory(
          "BANK",
          entry.scope,
          entry.idBankEntry,
          entry.amount,
          entry.description,
          occurredAt,
        ),
        reason,
      },
      transaction,
    );

    reversedCount += 1;
  }

  return reversedCount;
}

async function restoreSaleCustomerCredits(saleId, transaction) {
  const usages = await customerCreditsRepository.listCreditUsagesBySaleId(saleId, transaction);

  for (const usage of usages) {
    const credit = usage.CustomerCredit;
    if (!credit) {
      continue;
    }

    const nextBalanceAmount = roundCurrency(Number(credit.balanceAmount || 0) + Number(usage.amount || 0));

    await credit.update(
      {
        balanceAmount: nextBalanceAmount,
        status: "ACTIVE",
      },
      { transaction },
    );
  }

  return usages.length;
}

function addDays(baseDate, daysToAdd) {
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + daysToAdd,
    0,
    0,
    0,
    0,
  );
}

function roundCurrency(value) {
  return Number(Number(value).toFixed(2));
}

function buildReceivableInstallmentRedistribution(installments, newOriginalAmount) {
  const activeInstallments = installments.filter((installment) => installment.status !== "CANCELLED");
  const activeCount = activeInstallments.length;

  if (!activeCount || newOriginalAmount <= 0) {
    return installments.map((installment) => ({
      id: installment.idReceivableInstallment,
      amount: 0,
      paidAmount: 0,
      status: "CANCELLED",
      totalInstallments: installment.totalInstallments,
    }));
  }

  const templateInstallments = buildInstallments(
    newOriginalAmount,
    activeCount,
    activeInstallments[0]?.paymentTypeId ||
      activeInstallments[0]?.PaymentType?.idPaymentType ||
      1,
    activeInstallments[0]?.dueDate || new Date(),
  );

  let cursor = 0;

  return installments.map((installment) => {
    if (installment.status === "CANCELLED") {
      return {
        id: installment.idReceivableInstallment,
        amount: 0,
        paidAmount: 0,
        status: "CANCELLED",
        totalInstallments: installment.totalInstallments,
      };
    }

    const template = templateInstallments[cursor] || null;
    cursor += 1;

    return {
      id: installment.idReceivableInstallment,
      amount: template ? template.amount : 0,
      paidAmount: 0,
      status: template ? resolveInstallmentStatusByDueDate(installment.dueDate) : "CANCELLED",
      totalInstallments: activeCount,
    };
  });
}

function buildRefundDescription(saleId, itemDescription) {
  return `DEVOLUCAO PARCIAL DA VENDA ${saleId} - ${String(itemDescription || "").trim() || "ITEM"}`;
}

async function createSaleRefundEntries(saleId, itemDescription, refundAmount, reason, userId, transaction) {
  let remaining = roundCurrency(refundAmount);

  if (remaining <= 0) {
    return 0;
  }

  const occurredAt = new Date();
  const description = buildRefundDescription(saleId, itemDescription);
  const [cashEntries, bankEntries] = await Promise.all([
    cashRepository.listEntriesBySaleId(saleId, transaction),
    bankRepository.listEntriesBySaleId(saleId, transaction),
  ]);

  const incomingEntries = [
    ...cashEntries
      .filter((entry) => entry.movementType === "IN" && !isReversalDescription(entry.description))
      .map((entry) => ({ kind: "CASH", entry })),
    ...bankEntries
      .filter((entry) => entry.movementType === "IN" && !isReversalDescription(entry.description))
      .map((entry) => ({ kind: "BANK", entry })),
  ].sort((left, right) => {
    const leftTime = new Date(left.entry.occurredAt).getTime();
    const rightTime = new Date(right.entry.occurredAt).getTime();

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    const leftId = Number(left.kind === "CASH" ? left.entry.idCashEntry : left.entry.idBankEntry);
    const rightId = Number(right.kind === "CASH" ? right.entry.idCashEntry : right.entry.idBankEntry);
    return rightId - leftId;
  });

  let createdCount = 0;

  for (const item of incomingEntries) {
    if (remaining <= 0) {
      break;
    }

    const amount = roundCurrency(Math.min(remaining, Number(item.entry.amount || 0)));

    if (amount <= 0) {
      continue;
    }

    if (item.kind === "CASH") {
      await createCashEntry(
        {
          scope: item.entry.scope,
          movementType: "OUT",
          financialCategoryId: item.entry.financialCategoryId || null,
          category: item.entry.FinancialCategory?.description || item.entry.category,
          description,
          amount,
          occurredAt,
          sourceType: "MANUAL",
          saleId,
          paymentTypeId: item.entry.paymentTypeId || null,
          referenceCode: item.entry.referenceCode || null,
        },
        transaction,
      );

      await auditsRepository.createAudit(
        {
          auditTypeId: 3,
          userId,
          occurredAt,
          history: buildFinancialReversalHistory(
            "CASH",
            item.entry.scope,
            item.entry.idCashEntry,
            amount,
            description,
            occurredAt,
          ),
          reason,
        },
        transaction,
      );
    } else {
      await createBankEntry(
        {
          scope: item.entry.scope,
          movementType: "OUT",
          financialCategoryId: item.entry.financialCategoryId || null,
          category: item.entry.FinancialCategory?.description || item.entry.category,
          description,
          accountLabel: item.entry.accountLabel || "Banco da Loja",
          amount,
          occurredAt,
          sourceType: "MANUAL",
          saleId,
          paymentTypeId: item.entry.paymentTypeId || null,
          referenceCode: item.entry.referenceCode || null,
        },
        transaction,
      );

      await auditsRepository.createAudit(
        {
          auditTypeId: 4,
          userId,
          occurredAt,
          history: buildFinancialReversalHistory(
            "BANK",
            item.entry.scope,
            item.entry.idBankEntry,
            amount,
            description,
            occurredAt,
          ),
          reason,
        },
        transaction,
      );
    }

    remaining = roundCurrency(remaining - amount);
    createdCount += 1;
  }

  if (remaining > 0) {
    throw createSalesValidationError(
      "Nao foi possivel distribuir a devolucao entre os lancamentos financeiros da venda.",
    );
  }

  return createdCount;
}

function buildInstallments(
  amount,
  installmentCount,
  paymentTypeId,
  dueDate,
  options = {},
) {
  const strategy = options.strategy === "days_interval" ? "days_interval" : "monthly";
  const intervalDays = Number(options.intervalDays) > 0 ? Number(options.intervalDays) : 30;
  const baseDate = dueDate || new Date();
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

  return amounts.map((installmentAmount, index) => {
    const dueDateValue =
      strategy === "days_interval"
        ? addDays(baseDate, intervalDays * (index + 1))
        : addMonths(baseDate, index);

    return {
      paymentTypeId,
      installmentNumber: index + 1,
      totalInstallments: installmentCount,
      dueDate: dueDateValue,
      interestBaseDate: dueDateValue,
      amount: installmentAmount,
      paidAmount: 0,
      status: "OPEN",
    };
  });
}

function normalizeMeasurementRecord(record = {}) {
  if (!record || typeof record !== "object") {
    return [];
  }

  if (Array.isArray(record.values)) {
    return record.values.map(normalizeSingleMeasurementValue).filter(Boolean);
  }

  if ("measurementDefinitionId" in record || "key" in record || "value" in record) {
    const normalized = normalizeSingleMeasurementValue(record);
    return normalized ? [normalized] : [];
  }

  const normalized = [];

  for (const field of MEASUREMENT_FIELDS) {
    const value = normalizeDecimal(record[field], `Medida ${field}`);
    if (value === null) {
      continue;
    }

    normalized.push({
      measurementDefinitionId: null,
      key: field,
      value,
    });
  }

  return normalized;
}

function normalizeSingleMeasurementValue(record = {}) {
  const measurementDefinitionId =
    record.measurementDefinitionId === null ||
    record.measurementDefinitionId === undefined ||
    record.measurementDefinitionId === ""
      ? null
      : normalizeInteger(record.measurementDefinitionId, "Medida");
  const key = String(record.key || "").trim() || null;
  const value = normalizeDecimal(
    record.value,
    `Medida ${key || measurementDefinitionId || ""}`.trim(),
  );

  if (value === null) {
    return null;
  }

  if (!measurementDefinitionId && !key) {
    throw createSalesValidationError("Medida invalida.");
  }

  return {
    measurementDefinitionId,
    key,
    value,
  };
}

async function resolveMeasurementValues(records = []) {
  if (!Array.isArray(records) || !records.length) {
    return [];
  }

  const definitionRows = await repository.listMeasurementDefinitions();
  const definitionById = new Map(
    definitionRows.map((item) => [Number(item.idMeasurementDefinition), item]),
  );
  const definitionByKey = new Map(
    definitionRows.map((item) => [String(item.key), item]),
  );
  const normalizedByKey = new Map();

  for (const record of records) {
    const normalizedRecords = normalizeMeasurementRecord(record);

    for (const measurement of normalizedRecords) {
      const definition =
        (measurement.measurementDefinitionId
          ? definitionById.get(Number(measurement.measurementDefinitionId))
          : null) ||
        (measurement.key ? definitionByKey.get(String(measurement.key).trim()) : null);

      if (!definition) {
        const fallbackLabel =
          measurement.key && MEASUREMENT_DEFINITION_BY_KEY.get(measurement.key)?.label;
        throw createSalesValidationError(
          `Medida ${fallbackLabel || measurement.key || measurement.measurementDefinitionId} invalida.`,
        );
      }

      normalizedByKey.set(String(definition.key), {
        measurementDefinitionId: Number(definition.idMeasurementDefinition),
        key: String(definition.key),
        value: measurement.value,
      });
    }
  }

  return Array.from(normalizedByKey.values());
}

async function normalizeBudgetPaymentDraft(body = {}) {
  const hasAnyDraftValue = [
    body.paymentTypeId,
    body.installmentCount,
    body.installmentIntervalDays,
    body.dueDate,
    body.receiptFinancialAccountId,
    body.entryAmount,
    body.entryPaymentTypeId,
    body.entryFinancialAccountId,
    body.entryReferenceCode,
    body.paymentReferenceCode,
    body.useCustomerCredit,
    body.customerCreditAmount,
  ].some((value) => value !== null && value !== undefined && value !== "");

  if (!hasAnyDraftValue) {
    return null;
  }

  const paymentTypeId =
    body.paymentTypeId === null || body.paymentTypeId === undefined || body.paymentTypeId === ""
      ? null
      : normalizeInteger(body.paymentTypeId, "Forma de pagamento");
  const entryPaymentTypeId =
    body.entryPaymentTypeId === null ||
    body.entryPaymentTypeId === undefined ||
    body.entryPaymentTypeId === ""
      ? null
      : normalizeInteger(body.entryPaymentTypeId, "Forma da entrada");
  const receiptFinancialAccountId =
    body.receiptFinancialAccountId === null ||
    body.receiptFinancialAccountId === undefined ||
    body.receiptFinancialAccountId === ""
      ? null
      : normalizeInteger(body.receiptFinancialAccountId, "Recebido em");
  const entryFinancialAccountId =
    body.entryFinancialAccountId === null ||
    body.entryFinancialAccountId === undefined ||
    body.entryFinancialAccountId === ""
      ? null
      : normalizeInteger(body.entryFinancialAccountId, "Recebido em");

  if (paymentTypeId) {
    const paymentType = await paymentTypesRepository.getPaymentTypeById(paymentTypeId);
    if (!paymentType) {
      throw createSalesValidationError("Forma de pagamento invalida.");
    }
  }

  if (entryPaymentTypeId) {
    const entryPaymentType = await paymentTypesRepository.getPaymentTypeById(entryPaymentTypeId);
    if (!entryPaymentType) {
      throw createSalesValidationError("Forma da entrada invalida.");
    }
  }

  if (receiptFinancialAccountId) {
    const receiptAccount = await financialAccountsRepository.getById(receiptFinancialAccountId);
    if (!receiptAccount || receiptAccount.active === false) {
      throw createSalesValidationError("Recebido em invalido.");
    }
  }

  if (entryFinancialAccountId) {
    const entryAccount = await financialAccountsRepository.getById(entryFinancialAccountId);
    if (!entryAccount || entryAccount.active === false) {
      throw createSalesValidationError("Recebido em invalido.");
    }
  }

  return {
    paymentTypeId,
    installmentCount:
      body.installmentCount === null || body.installmentCount === undefined || body.installmentCount === ""
        ? null
        : normalizeInteger(body.installmentCount, "Quantidade de parcelas"),
    installmentIntervalDays:
      body.installmentIntervalDays === null ||
      body.installmentIntervalDays === undefined ||
      body.installmentIntervalDays === ""
        ? null
        : normalizeInteger(body.installmentIntervalDays, "Intervalo entre parcelas"),
    dueDate: normalizeDate(body.dueDate, "Data de vencimento"),
    receiptFinancialAccountId,
    entryAmount:
      body.entryAmount === null || body.entryAmount === undefined || body.entryAmount === ""
        ? null
        : roundCurrency(normalizeDecimal(body.entryAmount, "Valor da entrada")),
    entryPaymentTypeId,
    entryFinancialAccountId,
    entryReferenceCode: body.entryReferenceCode ? String(body.entryReferenceCode).trim() : null,
    paymentReferenceCode: body.paymentReferenceCode ? String(body.paymentReferenceCode).trim() : null,
    useCustomerCredit: Boolean(body.useCustomerCredit),
    customerCreditAmount:
      body.customerCreditAmount === null ||
      body.customerCreditAmount === undefined ||
      body.customerCreditAmount === ""
        ? null
        : roundCurrency(normalizeDecimal(body.customerCreditAmount, "Valor do credito")),
  };
}

function normalizeDebtExemption(body = {}) {
  const doesNotGenerateDebt = Boolean(body.doesNotGenerateDebt);
  const internalReason = doesNotGenerateDebt
    ? normalizeOptionalText(body.internalReason)
    : null;

  return {
    doesNotGenerateDebt,
    internalReason,
  };
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
    throw createSalesValidationError("Valores do item sao obrigatórios.");
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

async function getFinancialAccountOrDefault({
  idFinancialAccount,
  fieldName,
  defaultTargetType,
  allowCashDestination = false,
}) {
  if (idFinancialAccount !== null && idFinancialAccount !== undefined && idFinancialAccount !== "") {
    const normalizedId = normalizeInteger(idFinancialAccount, fieldName);
    const account = await financialAccountsRepository.getById(normalizedId);

    if (!account || account.active === false) {
      throw createSalesValidationError(`${fieldName} invalido.`);
    }

    if (!allowCashDestination && account.targetType !== "BANK") {
      throw createSalesValidationError(`${fieldName} invalido.`);
    }

    return account;
  }

  const fallback = await financialAccountsRepository.findDefaultByScopeAndTarget(
    "LOJA",
    defaultTargetType,
  );

  if (!fallback) {
    throw createSalesValidationError(`${fieldName} invalido.`);
  }

  return fallback;
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

function isCreditInstallmentPaymentType(paymentType) {
  return paymentType?.kind === "CARD";
}

function buildReceivablePayload({
  customerId,
  mainPaymentType,
  paymentTypeId,
  remainingAmount,
  installmentCount,
  dueDate,
  installmentIntervalDays,
}) {
  if (remainingAmount <= 0) {
    return null;
  }

  const usesCreditSchedule = isCreditInstallmentPaymentType(mainPaymentType);
  const effectiveDueDate = dueDate || new Date();
  const effectiveInstallmentCount = mainPaymentType.allowsInstallments ? installmentCount : 1;
  const installments = buildInstallments(
    remainingAmount,
    effectiveInstallmentCount,
    paymentTypeId,
    effectiveDueDate,
    usesCreditSchedule
      ? {
          strategy: "days_interval",
          intervalDays: installmentIntervalDays,
        }
      : undefined,
  );

  return {
    originalAmount: remainingAmount,
    debtorType: "CUSTOMER",
    customerId,
    operatorLabel: null,
    installments,
    cardTransaction: null,
  };
}

function buildIncomingFinancialMovement({
  paymentType,
  amount,
  paidAt,
  referenceCode,
  destinationAccount,
}) {
  if (!paymentType || Number(amount) <= 0) {
    return null;
  }

  if (paymentType.financialFlow !== "IMMEDIATE_CASH") {
    return null;
  }

  if (isImmediateCheckPaymentType(paymentType)) {
    return null;
  }

  const target =
    destinationAccount?.targetType === "CASH"
      ? "CASH"
      : destinationAccount?.targetType === "BANK"
        ? "BANK"
        : isImmediateCashPaymentType(paymentType)
          ? "CASH"
          : "BANK";
  const scope = destinationAccount?.scope || "LOJA";

  return {
    target,
    scope,
    movementType: "IN",
    category: "VENDA",
    description: `Recebimento da venda via ${paymentType.name}`,
    accountLabel: target === "BANK" ? destinationAccount?.desc || "Banco da Loja" : null,
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
  const itemMetadata = item.metadata && typeof item.metadata === "object" ? item.metadata : null;
  const productMode = String(itemMetadata?.productMode || "").trim() || null;
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || 0);
  const subtotal = Number(item.subtotal || 0);
  const grossAmount = Number((quantity * unitPrice).toFixed(2));
  const discountAmount = Number(Math.max(0, grossAmount - subtotal).toFixed(2));
  const cancellation = item.metadata?.cancellation || null;
  const isCancelled = Boolean(cancellation?.cancelledAt);

  return {
    id: item.idSaleItem,
    productId: item.productId || null,
    itemType: item.itemType,
    productMode,
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
    isCancelled,
    cancellation: cancellation
      ? {
          cancelledAt: cancellation.cancelledAt || null,
          reason: cancellation.reason || null,
          resolution: cancellation.resolution || null,
          refundAmount: Number(cancellation.refundAmount || 0),
          creditAmount: Number(cancellation.creditAmount || 0),
        }
      : null,
    productStatus: status?.desc || null,
    seamstress: employee?.shortName || employee?.fullName || null,
    fittingDate: product?.testDate || null,
  };
}

function mapMeasurementRecord(record) {
  const definition = record.MeasurementDefinition || record.MeasurementDefinitions || null;
  const key = definition?.key || record.key || null;
  const fallbackLabel =
    (key && MEASUREMENT_DEFINITION_BY_KEY.get(String(key))?.label) ||
    (definition?.label ? String(definition.label) : null);

  return {
    idCustomerMeasurementValue: Number(record.idCustomerMeasurementValue || 0),
    idMeasurementDefinition:
      Number(definition?.idMeasurementDefinition || record.measurementDefinitionId || 0) || null,
    key,
    label: fallbackLabel || key || "Medida",
    value: record.value === null || record.value === undefined ? null : Number(record.value),
  };
}

function mapBudgetPaymentDraft(draft) {
  if (!draft) return null;

  const paymentType = draft.PaymentType || draft.PaymentTypes || null;
  const entryPaymentType = draft.EntryPaymentType || null;
  const receiptFinancialAccount =
    draft.ReceiptFinancialAccount || draft.ReceiptFinancialAccounts || null;
  const entryFinancialAccount =
    draft.EntryFinancialAccount || draft.EntryFinancialAccounts || null;

  return {
    paymentTypeId: draft.paymentTypeId || null,
    paymentTypeName: paymentType?.desc || null,
    installmentCount:
      draft.installmentCount === null || draft.installmentCount === undefined
        ? null
        : Number(draft.installmentCount),
    installmentIntervalDays:
      draft.installmentIntervalDays === null || draft.installmentIntervalDays === undefined
        ? null
        : Number(draft.installmentIntervalDays),
    dueDate: draft.dueDate || null,
    receiptFinancialAccountId: draft.receiptFinancialAccountId || null,
    receiptFinancialAccountName: receiptFinancialAccount?.desc || null,
    entryAmount:
      draft.entryAmount === null || draft.entryAmount === undefined ? null : Number(draft.entryAmount),
    entryPaymentTypeId: draft.entryPaymentTypeId || null,
    entryPaymentTypeName: entryPaymentType?.desc || null,
    entryFinancialAccountId: draft.entryFinancialAccountId || null,
    entryFinancialAccountName: entryFinancialAccount?.desc || null,
    entryReferenceCode: draft.entryReferenceCode || null,
    paymentReferenceCode: draft.paymentReferenceCode || null,
    useCustomerCredit: Boolean(draft.useCustomerCredit),
    customerCreditAmount:
      draft.customerCreditAmount === null || draft.customerCreditAmount === undefined
        ? null
        : Number(draft.customerCreditAmount),
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
  const fallbackPaymentTypeName =
    receipt.receiptType === "CUSTOMER_CREDIT" ? "Credito da cliente" : null;
  const cashEntries = Array.isArray(receipt.CashEntries) ? receipt.CashEntries : [];
  const bankEntries = Array.isArray(receipt.BankEntries) ? receipt.BankEntries : [];
  const firstBankEntry = bankEntries[0] || null;
  const firstCashEntry = cashEntries[0] || null;
  const accountLabel = firstBankEntry?.accountLabel
    ? String(firstBankEntry.accountLabel).trim()
    : firstCashEntry
      ? firstCashEntry.scope === "PESSOAL"
        ? "Caixa Pessoal"
        : "Caixa da Loja"
      : null;

  return {
    id: receipt.idPaymentReceipt,
    saleId: receipt.saleId,
    receivableInstallmentId: receipt.receivableInstallmentId || null,
    receiptType: receipt.receiptType,
    amount: Number(receipt.amount || 0),
    paidAt: receipt.paidAt,
    referenceCode: receipt.referenceCode || null,
    accountLabel: accountLabel || null,
    paymentType: paymentType
      ? {
        id: paymentType.idPaymentType,
        name: paymentType.desc,
      }
      : fallbackPaymentTypeName
        ? {
            id: 0,
            name: fallbackPaymentTypeName,
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

function buildSalePaymentSummary(sale) {
  const paymentNames = [];
  const pushName = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    if (paymentNames.includes(normalized)) return;
    paymentNames.push(normalized);
  };

  const paymentType = sale.PaymentType || sale.PaymentTypes;
  pushName(paymentType?.desc);

  if (Array.isArray(sale.PaymentReceipts)) {
    sale.PaymentReceipts.forEach((receipt) => {
      const receiptPaymentType = receipt.PaymentType || receipt.PaymentTypes;
      pushName(receiptPaymentType?.desc);
    });
  }

  return paymentNames.join(" + ") || null;
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
  const measurements = Array.isArray(sale.CustomerMeasurementValues)
    ? sale.CustomerMeasurementValues
        .map(mapMeasurementRecord)
        .sort((left, right) => {
          const leftOrder = MEASUREMENT_FIELDS.indexOf(String(left.key || ""));
          const rightOrder = MEASUREMENT_FIELDS.indexOf(String(right.key || ""));

          if (leftOrder !== rightOrder) {
            if (leftOrder === -1) return 1;
            if (rightOrder === -1) return -1;
            return leftOrder - rightOrder;
          }

          return String(left.label || "").localeCompare(String(right.label || ""), "pt-BR");
        })
    : [];
  const measurementsCount = measurements.length;
  const budgetPaymentDraft = mapBudgetPaymentDraft(
    sale.SaleBudgetPaymentDraft || sale.SaleBudgetPaymentDrafts || null,
  );

  return {
    id: sale.idSale,
    status: resolveSaleStatus(sale),
    doesNotGenerateDebt: Boolean(sale.doesNotGenerateDebt),
    internalReason: sale.internalReason || null,
    debtExemptionLabel: sale.doesNotGenerateDebt
      ? "Esta venda não gera débitos"
      : null,
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
    measurements,
    paymentDraft: budgetPaymentDraft,
    netReceivedAmount: 0,
    customerCreditAmount: 0,
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

async function enrichSaleFinancialSummary(saleDetails) {
  const [cashEntries, bankEntries, saleCredits] = await Promise.all([
    cashRepository.listEntriesBySaleId(saleDetails.id),
    bankRepository.listEntriesBySaleId(saleDetails.id),
    customerCreditsRepository.listCreditsBySaleId(saleDetails.id),
  ]);

  const netReceivedAmount = roundCurrency(
    [...cashEntries, ...bankEntries].reduce((acc, entry) => {
      const sign = entry.movementType === "IN" ? 1 : -1;
      return acc + sign * Number(entry.amount || 0);
    }, 0),
  );
  const customerCreditReceiptAmount = roundCurrency(
    Array.isArray(saleDetails.receipts)
      ? saleDetails.receipts
          .filter((item) => item.receiptType === "CUSTOMER_CREDIT")
          .reduce((acc, item) => acc + Number(item.amount || 0), 0)
      : 0,
  );

  return {
    ...saleDetails,
    netReceivedAmount: roundCurrency(netReceivedAmount + customerCreditReceiptAmount),
    customerCreditAmount: roundCurrency(
      saleCredits.reduce((acc, item) => acc + Number(item.balanceAmount || 0), 0),
    ),
    customerCredits: saleCredits.map((item) => ({
      id: item.idCustomerCredit,
      originalAmount: Number(item.originalAmount || 0),
      balanceAmount: Number(item.balanceAmount || 0),
      description: item.description,
      status: item.status,
      createdAt: item.createdAt,
    })),
  };
}

function mapSaleListItem(sale) {
  const customer = sale.Customer || sale.Customers;
  const items = Array.isArray(sale.SaleItems) ? sale.SaleItems : [];

  return {
    id: sale.idSale,
    status: resolveSaleStatus(sale),
    doesNotGenerateDebt: Boolean(sale.doesNotGenerateDebt),
    internalReason: sale.internalReason || null,
    debtExemptionLabel: sale.doesNotGenerateDebt
      ? "Esta venda não gera débitos"
      : null,
    customerName: customer?.fullName || customer?.companyName || "Sem cliente",
    paymentTypeName: buildSalePaymentSummary(sale),
    itemsCount: items.length,
    firstItemDescription: items[0]?.description || null,
    finalAmount: Number(sale.finalAmount || 0),
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  };
}

async function createSale(body = {}) {
  const debtExemption = normalizeDebtExemption(body);
  const shouldCreateQuote =
    !debtExemption.doesNotGenerateDebt &&
    (body.paymentTypeId === null ||
      body.paymentTypeId === undefined ||
      body.paymentTypeId === "");

  if (shouldCreateQuote) {
    return createQuote(body);
  }

  return finalizeSaleFromScratch(body);
}

async function normalizeQuoteBase(body = {}) {
  const customerId = normalizeInteger(body.customerId, "Cliente");
  const items = Array.isArray(body.items) ? body.items.map(normalizeSaleItem) : [];

  if (!items.length) {
    throw createSalesValidationError("Adicione ao menos um item na venda.");
  }

  const totalAmount = normalizeDecimal(body.totalAmount, "Valor total");
  const finalAmount = normalizeDecimal(body.finalAmount, "Valor final");

  if (totalAmount === null || finalAmount === null) {
    throw createSalesValidationError("Valores totais sao obrigatórios.");
  }

  const customerMeasurements = await resolveMeasurementValues(body.customerMeasurements);

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
  const customerCreditApplication = await resolveCustomerCreditApplication(
    body,
    customerId,
    finalAmount,
  );
  const mainPaymentType = await getRequiredPaymentType(body.paymentTypeId, "Forma de pagamento");
  const isCreditPayment = isCreditInstallmentPaymentType(mainPaymentType);
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

  if (isCreditPayment && dueDate) {
    throw createSalesValidationError("O vencimento do credito e calculado automaticamente pelo intervalo de dias.");
  }

  const installmentIntervalDays =
    body.installmentIntervalDays === null ||
    body.installmentIntervalDays === undefined ||
    body.installmentIntervalDays === ""
      ? 30
      : normalizeInteger(body.installmentIntervalDays, "Intervalo entre parcelas");

  const entryAmount =
    body.entryAmount === null || body.entryAmount === undefined || body.entryAmount === ""
      ? 0
      : normalizeDecimal(body.entryAmount, "Valor da entrada");

  let entryReceipt = null;
  let entryPaymentType = null;
  let financialMovement = null;
  let receiptFinancialAccount = null;
  let entryFinancialAccount = null;

  if (entryAmount !== null && entryAmount > 0) {
    entryPaymentType = await getRequiredPaymentType(
      body.entryPaymentTypeId,
      "Forma de pagamento da entrada",
    );
    validateEntryPaymentType(mainPaymentType, entryPaymentType);

    if (entryAmount + customerCreditApplication.amount >= finalAmount) {
      throw createSalesValidationError("O valor da entrada deve ser menor que o valor final.");
    }

    entryReceipt = {
      paymentTypeId: entryPaymentType.id,
      receiptType: "ENTRY",
      amount: roundCurrency(entryAmount),
      paidAt: normalizeDate(body.entryPaidAt, "Data da entrada") || new Date(),
      referenceCode: body.entryReferenceCode ? String(body.entryReferenceCode).trim() : null,
    };

    entryFinancialAccount = await getFinancialAccountOrDefault({
      idFinancialAccount: body.entryFinancialAccountId,
      fieldName: "Recebido em",
      defaultTargetType: isImmediateCashPaymentType(entryPaymentType) ? "CASH" : "BANK",
      allowCashDestination: isImmediateCashPaymentType(entryPaymentType),
    });

    financialMovement = buildIncomingFinancialMovement({
      paymentType: entryPaymentType,
      amount: entryReceipt.amount,
      paidAt: entryReceipt.paidAt,
      referenceCode: entryReceipt.referenceCode,
      destinationAccount: entryFinancialAccount,
    });
  } else if (
    body.entryPaymentTypeId ||
    body.entryFinancialAccountId ||
    body.entryPaidAt ||
    body.entryReferenceCode
  ) {
    throw createSalesValidationError("Informe um valor de entrada valido para registrar a entrada.");
  }

  if (!entryReceipt && mainPaymentType.financialFlow === "IMMEDIATE_CASH") {
    const paymentReferenceCode = body.paymentReferenceCode
      ? String(body.paymentReferenceCode).trim()
      : null;

    if (isImmediateCheckPaymentType(mainPaymentType) && !paymentReferenceCode) {
      throw createSalesValidationError("Numero do cheque é obrigatório.");
    }

    entryReceipt = {
      paymentTypeId: mainPaymentType.id,
      receiptType: "SALE_FULL",
      amount: roundCurrency(finalAmount - customerCreditApplication.amount),
      paidAt: new Date(),
      referenceCode: paymentReferenceCode,
    };

    receiptFinancialAccount = await getFinancialAccountOrDefault({
      idFinancialAccount: body.receiptFinancialAccountId,
      fieldName: "Recebido em",
      defaultTargetType: isImmediateCashPaymentType(mainPaymentType) ? "CASH" : "BANK",
      allowCashDestination: isImmediateCashPaymentType(mainPaymentType),
    });

    financialMovement = buildIncomingFinancialMovement({
      paymentType: mainPaymentType,
      amount: entryReceipt.amount,
      paidAt: entryReceipt.paidAt,
      referenceCode: entryReceipt.referenceCode,
      destinationAccount: receiptFinancialAccount,
    });
  }

  const remainingAmount = roundCurrency(
    finalAmount - customerCreditApplication.amount - (entryReceipt?.amount || 0),
  );
  const receivable = buildReceivablePayload({
    customerId,
    mainPaymentType,
    paymentTypeId: mainPaymentType.id,
    remainingAmount,
    installmentCount,
    dueDate,
    installmentIntervalDays,
  });

  const resolvedDueDate =
    receivable?.installments?.[0]?.dueDate ||
    dueDate ||
    null;

  return {
    mainPaymentType,
    installmentCount,
    dueDate: resolvedDueDate,
    installmentIntervalDays,
    entryReceipt,
    additionalReceipts: customerCreditApplication.receipt ? [customerCreditApplication.receipt] : [],
    customerCreditUsages: customerCreditApplication.usages,
    customerCreditAmount: customerCreditApplication.amount,
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
    doesNotGenerateDebt: Boolean(created.sale.doesNotGenerateDebt),
    internalReason: created.sale.internalReason || null,
    productsCount: created.products?.length || 0,
    itemsCount: created.items?.length || created.sale.SaleItems?.length || 0,
    measurementsCount: created.measurements?.length || 0,
    entryReceiptId: created.entryReceipt?.idPaymentReceipt || null,
    additionalReceiptIds: Array.isArray(created.additionalReceipts)
      ? created.additionalReceipts.map((item) => item.idPaymentReceipt)
      : [],
    receivableId: created.receivable?.receivable?.idReceivable || created.receivable?.idReceivable || null,
    ...extra,
  };
}

async function createQuote(body = {}) {
  const normalized = await normalizeQuoteBase(body);
  const budgetPaymentDraft = await normalizeBudgetPaymentDraft(body);
  const debtExemption = normalizeDebtExemption(body);

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
      doesNotGenerateDebt: debtExemption.doesNotGenerateDebt,
      internalReason: debtExemption.internalReason,
    },
    items: normalized.items,
    customerMeasurements: normalized.customerMeasurements,
    budgetPaymentDraft,
    entryReceipt: null,
    additionalReceipts: [],
    customerCreditUsages: [],
    receivable: null,
    financialMovements: [],
    createProducts: false,
  });

  return buildSaleResponse(created, {
    quote: true,
  });
}

function validateEditableBudgetSale(sale) {
  if (!sale) {
    throw notFoundError("Venda nao encontrada.");
  }

  if (sale.status !== "BUDGET") {
    throw createSalesValidationError("Somente orçamentos em aberto podem ser alterados.");
  }

  if (sale.PaymentReceipts?.length || sale.Receivable || sale.CardTransaction || sale.CardTransactions) {
    throw createSalesValidationError("Este orçamento ja possui registros financeiros vinculados.");
  }
}

async function updateQuote(id, body = {}) {
  const normalizedId = Number(id);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw createSalesValidationError("Venda invalida.");
  }

  const normalized = await normalizeQuoteBase(body);
  const budgetPaymentDraft = await normalizeBudgetPaymentDraft(body);
  const debtExemption = normalizeDebtExemption(body);
  const sale = await repository.getSaleForFinalization(normalizedId);
  validateEditableBudgetSale(sale);

  const updated = await repository.updateQuote(normalizedId, {
    sale: {
      customerId: normalized.customerId,
      userId: normalized.userId,
      discountType: normalized.discountType,
      discountValue: normalized.discountValue,
      doesNotGenerateDebt: debtExemption.doesNotGenerateDebt,
      internalReason: debtExemption.internalReason,
      totalAmount: normalized.totalAmount,
      finalAmount: normalized.finalAmount,
    },
    items: normalized.items,
    customerMeasurements: normalized.customerMeasurements,
    budgetPaymentDraft,
  });

  if (!updated) {
    throw notFoundError("Venda nao encontrada.");
  }

  return buildSaleResponse(updated, {
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
    throw createSalesValidationError("Somente vendas em orçamento podem ser concluidas.");
  }

  const items = Array.isArray(sale.SaleItems) ? sale.SaleItems : [];

  if (!items.length) {
    throw createSalesValidationError("Nao foi possivel concluir um orçamento sem itens.");
  }

  if (sale.PaymentReceipts?.length || sale.Receivable || sale.CardTransaction || sale.CardTransactions) {
    throw createSalesValidationError("Este orçamento ja possui registros financeiros vinculados.");
  }

  const debtExemption = normalizeDebtExemption(body);

  if (!debtExemption.doesNotGenerateDebt) {
    await ensureOpenStoreCashSessionForSaleFinalization();
  }

  const finalization = debtExemption.doesNotGenerateDebt
    ? {
        mainPaymentType: null,
        installmentCount: 1,
        dueDate: null,
        installmentIntervalDays: null,
        entryReceipt: null,
        additionalReceipts: [],
        customerCreditUsages: [],
        customerCreditAmount: 0,
        financialMovement: [],
        receivable: null,
        remainingAmount: 0,
      }
    : await normalizeFinalizationPayload(body, {
        customerId: sale.customerId,
        finalAmount: Number(sale.finalAmount || 0),
      });

  const finalStatus = deriveSaleStatusFromItems(items);

  const finalized = await repository.finalizeSale(normalizedId, {
    sale: {
      status: finalStatus,
      dueDate: finalization.dueDate || null,
      paymentTypeId: finalization.mainPaymentType?.id || null,
      installmentCount: finalization.installmentCount,
      doesNotGenerateDebt: debtExemption.doesNotGenerateDebt,
      internalReason: debtExemption.internalReason,
    },
    entryReceipt: finalization.entryReceipt,
    additionalReceipts: finalization.additionalReceipts,
    customerCreditUsages: finalization.customerCreditUsages,
    receivable: finalization.receivable,
    financialMovements: finalization.financialMovement,
  });

  if (!finalized) {
    throw notFoundError("Venda nao encontrada.");
  }

  return buildSaleResponse(finalized, {
    paymentPreview: {
      paymentTypeId: finalization.mainPaymentType?.id || null,
      paymentTypeName: finalization.mainPaymentType?.name || null,
      entryAmount: roundCurrency(finalization.entryReceipt?.amount || 0),
      customerCreditAmount: roundCurrency(finalization.customerCreditAmount || 0),
      remainingAmount: finalization.remainingAmount,
      debtorType: finalization.receivable?.debtorType || null,
      installments:
        finalization.receivable?.installments.map((installment) => ({
          installmentNumber: installment.installmentNumber,
          totalInstallments: installment.totalInstallments,
          dueDate: installment.dueDate,
          amount: installment.amount,
        })) || [],
      installmentIntervalDays: finalization.installmentIntervalDays,
    },
  });
}

async function finalizeSaleFromScratch(body = {}) {
  const normalized = await normalizeQuoteBase(body);
  const debtExemption = normalizeDebtExemption(body);
  if (!debtExemption.doesNotGenerateDebt) {
    await ensureOpenStoreCashSessionForSaleFinalization();
  }
  const finalization = debtExemption.doesNotGenerateDebt
    ? {
        mainPaymentType: null,
        installmentCount: 1,
        dueDate: null,
        installmentIntervalDays: null,
        entryReceipt: null,
        additionalReceipts: [],
        customerCreditUsages: [],
        customerCreditAmount: 0,
        financialMovement: [],
        receivable: null,
        remainingAmount: 0,
      }
    : await normalizeFinalizationPayload(body, {
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
      dueDate: finalization.dueDate || null,
      paymentTypeId: finalization.mainPaymentType?.id || null,
      installmentCount: finalization.installmentCount,
      doesNotGenerateDebt: debtExemption.doesNotGenerateDebt,
      internalReason: debtExemption.internalReason,
    },
    items: normalized.items,
    customerMeasurements: normalized.customerMeasurements,
    entryReceipt: finalization.entryReceipt,
    additionalReceipts: finalization.additionalReceipts,
    customerCreditUsages: finalization.customerCreditUsages,
    receivable: finalization.receivable,
    financialMovements: finalization.financialMovement,
  });

  return buildSaleResponse(created, {
    paymentPreview: {
      paymentTypeId: finalization.mainPaymentType?.id || null,
      paymentTypeName: finalization.mainPaymentType?.name || null,
      entryAmount: roundCurrency(finalization.entryReceipt?.amount || 0),
      customerCreditAmount: roundCurrency(finalization.customerCreditAmount || 0),
      remainingAmount: finalization.remainingAmount,
      debtorType: finalization.receivable?.debtorType || null,
      installments:
        finalization.receivable?.installments.map((installment) => ({
          installmentNumber: installment.installmentNumber,
          totalInstallments: installment.totalInstallments,
          dueDate: installment.dueDate,
          amount: installment.amount,
        })) || [],
      installmentIntervalDays: finalization.installmentIntervalDays,
    },
  });
}

async function cancelSale(id, user, body = {}) {
  const normalizedId = Number(id);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw createSalesValidationError("Venda invalida.");
  }

  const reason = normalizeRequiredText(body.reason, "Motivo");
  const userId = normalizeUserId(user);
  const occurredAt = new Date();

  const sale = await repository.getSaleById(normalizedId);

  if (!sale) {
    throw notFoundError("Venda nao encontrada.");
  }

  if (resolveSaleStatus(sale) === "CANCELLED") {
    throw createSalesValidationError("A venda ja esta cancelada.");
  }

  const cancelled = await sequelize.transaction(async (transaction) => {
    const [reversedCashEntries, reversedBankEntries, restoredCustomerCredits] = await Promise.all([
      reverseSaleCashEntries(normalizedId, occurredAt, reason, userId, transaction),
      reverseSaleBankEntries(normalizedId, occurredAt, reason, userId, transaction),
      restoreSaleCustomerCredits(normalizedId, transaction),
    ]);

    const result = await repository.cancelSale(normalizedId, transaction);

    await auditsRepository.createAudit(
      {
        auditTypeId: 5,
        userId,
        occurredAt,
        history: buildSaleCancellationAuditHistory(result || sale, occurredAt),
        reason,
      },
      transaction,
    );

    return {
      sale: result,
      reversedCashEntries,
      reversedBankEntries,
      restoredCustomerCredits,
    };
  });

  if (!cancelled?.sale) {
    throw notFoundError("Venda nao encontrada.");
  }

  return {
    id: cancelled.sale.idSale,
    status: "CANCELLED",
    reversedCashEntries: cancelled.reversedCashEntries,
    reversedBankEntries: cancelled.reversedBankEntries,
    restoredCustomerCredits: cancelled.restoredCustomerCredits,
    message: "Venda cancelada com sucesso.",
  };
}

async function cancelSaleItem(saleId, itemId, user, body = {}) {
  const normalizedSaleId = Number(saleId);
  const normalizedItemId = Number(itemId);

  if (!Number.isInteger(normalizedSaleId) || normalizedSaleId <= 0) {
    throw createSalesValidationError("Venda invalida.");
  }

  if (!Number.isInteger(normalizedItemId) || normalizedItemId <= 0) {
    throw createSalesValidationError("Item da venda invalido.");
  }

  const reason = normalizeRequiredText(body.reason, "Motivo");
  const resolution = normalizeFinancialResolution(body.financialResolution);
  const userId = normalizeUserId(user);
  const occurredAt = new Date();

  return sequelize.transaction(async (transaction) => {
    const sale = await repository.getSaleForItemCancellation(
      normalizedSaleId,
      normalizedItemId,
      transaction,
    );

    if (!sale) {
      throw notFoundError("Venda nao encontrada.");
    }

    if (resolveSaleStatus(sale) === "CANCELLED") {
      throw createSalesValidationError("Nao e possivel cancelar item de uma venda cancelada.");
    }

    const items = Array.isArray(sale.SaleItems) ? sale.SaleItems : [];
    const targetItem = items.find((item) => Number(item.idSaleItem) === normalizedItemId);

    if (!targetItem) {
      throw notFoundError("Item da venda nao encontrado.");
    }

    if (isCancelledSaleItem(targetItem)) {
      throw createSalesValidationError("Este item ja foi cancelado.");
    }

    const activeItems = items.filter((item) => !isCancelledSaleItem(item));

    if (activeItems.length <= 1) {
      throw createSalesValidationError(
        "Nao e possivel cancelar o ultimo item por este fluxo. Utilize o cancelamento da venda.",
      );
    }

    const hasInstallmentReceipts = Array.isArray(sale.PaymentReceipts)
      ? sale.PaymentReceipts.some((receipt) => receipt.receiptType === "INSTALLMENT")
      : false;

    if (hasInstallmentReceipts) {
      throw createSalesValidationError(
        "O cancelamento parcial ainda nao esta disponivel para vendas com parcelas ja baixadas. Utilize o ajuste financeiro.",
      );
    }

    const remainingActiveItems = activeItems.filter(
      (item) => Number(item.idSaleItem) !== normalizedItemId,
    );
    const nextTotalAmount = roundCurrency(
      remainingActiveItems.reduce(
        (acc, item) => acc + Number(item.quantity || 0) * Number(item.unitPrice || 0),
        0,
      ),
    );
    const nextFinalAmount = roundCurrency(
      remainingActiveItems.reduce((acc, item) => acc + Number(item.subtotal || 0), 0),
    );
    const nextDiscountAmount = roundCurrency(Math.max(0, nextTotalAmount - nextFinalAmount));

    const [saleCashEntries, saleBankEntries] = await Promise.all([
      cashRepository.listEntriesBySaleId(normalizedSaleId, transaction),
      bankRepository.listEntriesBySaleId(normalizedSaleId, transaction),
    ]);

    const netCollectedAmount = roundCurrency(
      [...saleCashEntries, ...saleBankEntries].reduce((acc, entry) => {
        const sign = entry.movementType === "IN" ? 1 : -1;
        return acc + sign * Number(entry.amount || 0);
      }, 0),
    );
    const overpaymentAmount = roundCurrency(Math.max(0, netCollectedAmount - nextFinalAmount));

    if (overpaymentAmount > 0 && !resolution) {
      throw createSalesValidationError(
        "Escolha o tratamento financeiro do valor ja recebido para concluir o cancelamento da peca.",
      );
    }

    if (overpaymentAmount > 0 && resolution === "APPLY_REMAINING") {
      throw createSalesValidationError(
        "Nao existe saldo restante suficiente para abater esse valor. Escolha devolucao ou credito.",
      );
    }

    let refundAmount = 0;
    let creditAmount = 0;
    let refundEntriesCreated = 0;

    if (overpaymentAmount > 0 && resolution === "REFUND") {
      refundAmount = overpaymentAmount;
      refundEntriesCreated = await createSaleRefundEntries(
        normalizedSaleId,
        targetItem.description,
        refundAmount,
        reason,
        userId,
        transaction,
      );
    }

    if (overpaymentAmount > 0 && resolution === "CREDIT") {
      creditAmount = overpaymentAmount;
      await customerCreditsRepository.createCustomerCredit(
        {
          customerId: sale.customerId,
          saleId: normalizedSaleId,
          saleItemId: normalizedItemId,
          originalAmount: creditAmount,
          balanceAmount: creditAmount,
          description: buildCustomerCreditDescription(normalizedSaleId, targetItem.description),
          status: "ACTIVE",
        },
        transaction,
      );
    }

    const standaloneReceivedAmount = roundCurrency(
      Array.isArray(sale.PaymentReceipts)
        ? sale.PaymentReceipts
            .filter((receipt) => receipt.receiptType !== "INSTALLMENT")
            .reduce((acc, receipt) => acc + Number(receipt.amount || 0), 0)
        : 0,
    );
    const effectiveStandaloneReceived = roundCurrency(
      Math.max(0, standaloneReceivedAmount - refundAmount),
    );

    const receivable = sale.Receivable || sale.Receivables || null;
    const nextReceivableOriginalAmount = roundCurrency(
      Math.max(0, nextFinalAmount - effectiveStandaloneReceived),
    );
    const cancellationMetadata = {
      ...(targetItem.metadata || {}),
      cancellation: {
        cancelledAt: occurredAt.toISOString(),
        reason,
        resolution: resolution || null,
        refundAmount,
        creditAmount,
        cancelledByUserId: userId,
      },
    };

    await repository.updateSaleItem(
      normalizedItemId,
      {
        metadata: cancellationMetadata,
      },
      transaction,
    );

    if (targetItem.productId) {
      const cancelledStatus = await repository.getOrCreateCancelledStatus(transaction);
      await repository.updateProductStatusByIds([targetItem.productId], cancelledStatus.id, transaction);
    }

    await repository.updateSaleSummary(
      normalizedSaleId,
      {
        totalAmount: nextTotalAmount,
        finalAmount: nextFinalAmount,
        discountType: nextDiscountAmount > 0 ? "FIXED" : null,
        discountValue: nextDiscountAmount > 0 ? nextDiscountAmount : null,
      },
      transaction,
    );

    if (receivable) {
      if (nextReceivableOriginalAmount <= 0) {
        await repository.updateReceivable(
          receivable.idReceivable,
          {
            originalAmount: 0,
            openAmount: 0,
            status: "CANCELLED",
          },
          transaction,
        );

        for (const installment of receivable.ReceivableInstallments || []) {
          await repository.updateReceivableInstallment(
            installment.idReceivableInstallment,
            {
              amount: 0,
              paidAmount: 0,
              status: "CANCELLED",
            },
            transaction,
          );
        }
      } else {
        const redistributedInstallments = buildReceivableInstallmentRedistribution(
          receivable.ReceivableInstallments || [],
          nextReceivableOriginalAmount,
        );

        await repository.updateReceivable(
          receivable.idReceivable,
          {
            originalAmount: nextReceivableOriginalAmount,
            openAmount: nextReceivableOriginalAmount,
            status: "OPEN",
          },
          transaction,
        );

        for (const installment of redistributedInstallments) {
          await repository.updateReceivableInstallment(
            installment.id,
            {
              amount: installment.amount,
              paidAmount: installment.paidAmount,
              status: installment.status,
              totalInstallments: installment.totalInstallments,
            },
            transaction,
          );
        }
      }
    }

    await auditsRepository.createAudit(
      {
        auditTypeId: 5,
        userId,
        occurredAt,
        history: buildSaleItemCancellationAuditHistory(normalizedSaleId, targetItem, occurredAt),
        reason,
      },
      transaction,
    );

    return {
      idSale: normalizedSaleId,
      idSaleItem: normalizedItemId,
      nextFinalAmount,
      refundAmount,
      creditAmount,
      refundEntriesCreated,
      message: "Item cancelado com sucesso.",
    };
  });
}

async function renegotiateSalePayment(id, user, body = {}) {
  const normalizedId = Number(id);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw createSalesValidationError("Venda invalida.");
  }

  const reason = normalizeRequiredText(body.reason, "Motivo");
  const sale = await repository.getSaleById(normalizedId);

  if (!sale) {
    throw notFoundError("Venda nao encontrada.");
  }

  if (resolveSaleStatus(sale) === "CANCELLED") {
    throw createSalesValidationError("Nao e possivel renegociar uma venda cancelada.");
  }

  const receivable = sale.Receivable || sale.Receivables || null;

  if (!receivable || Number(receivable.openAmount || 0) <= 0) {
    throw createSalesValidationError("Esta venda nao possui saldo em aberto para renegociar.");
  }

  if (receivable.debtorType !== "CUSTOMER") {
    throw createSalesValidationError(
      "A renegociacao desta etapa esta disponivel apenas para contas a receber de cliente.",
    );
  }

  const installments = Array.isArray(receivable.ReceivableInstallments)
    ? receivable.ReceivableInstallments
    : [];
  const partiallyPaidInstallment = installments.find(
    (installment) => Number(installment.paidAmount || 0) > 0 && installment.status !== "PAID",
  );

  if (partiallyPaidInstallment) {
    throw createSalesValidationError(
      "Nao e possivel renegociar parcelas parcialmente pagas por este fluxo. Utilize o ajuste financeiro.",
    );
  }

  const mainPaymentType = await getRequiredPaymentType(body.paymentTypeId, "Forma de pagamento");

  if (mainPaymentType.financialFlow !== "FUTURE_CUSTOMER") {
    throw createSalesValidationError(
      "A renegociacao desta etapa exige uma forma de pagamento com recebimento futuro do cliente.",
    );
  }

  const installmentCount =
    body.installmentCount === null || body.installmentCount === undefined || body.installmentCount === ""
      ? Number(mainPaymentType.defaultInstallments || 1)
      : normalizeInteger(body.installmentCount, "Quantidade de parcelas");
  validateInstallmentCount(mainPaymentType, installmentCount);

  const dueDate = normalizeDate(body.dueDate, "Data de vencimento");
  if (mainPaymentType.requiresDueDate && !dueDate) {
    throw createSalesValidationError("Data de vencimento e obrigatoria.");
  }

  const installmentIntervalDays =
    body.installmentIntervalDays === null ||
    body.installmentIntervalDays === undefined ||
    body.installmentIntervalDays === ""
      ? 30
      : normalizeInteger(body.installmentIntervalDays, "Intervalo entre parcelas");

  const paidInstallments = installments.filter((installment) => installment.status === "PAID");
  const unpaidInstallments = installments.filter((installment) => installment.status !== "PAID");

  if (!unpaidInstallments.length) {
    throw createSalesValidationError("Nao existem parcelas abertas para renegociar.");
  }

  const openAmount = roundCurrency(receivable.openAmount || 0);
  const newInstallments = buildInstallments(
    openAmount,
    installmentCount,
    mainPaymentType.id,
    dueDate || new Date(),
    undefined,
  );
  const newTotalInstallments = paidInstallments.length + newInstallments.length;
  const userId = normalizeUserId(user);
  const occurredAt = new Date();

  await sequelize.transaction(async (transaction) => {
    if (paidInstallments.length) {
      for (const installment of paidInstallments) {
        await repository.updateReceivableInstallment(
          installment.idReceivableInstallment,
          {
            totalInstallments: newTotalInstallments,
          },
          transaction,
        );
      }
    }

    await repository.deleteReceivableInstallmentsByIds(
      unpaidInstallments.map((installment) => installment.idReceivableInstallment),
      transaction,
    );

    await repository.createReceivableInstallments(
      newInstallments.map((installment, index) => ({
        receivableId: receivable.idReceivable,
        paymentTypeId: installment.paymentTypeId,
        installmentNumber: paidInstallments.length + index + 1,
        totalInstallments: newTotalInstallments,
        dueDate: installment.dueDate,
        interestBaseDate: installment.interestBaseDate,
        amount: installment.amount,
        paidAmount: 0,
        status: installment.status,
      })),
      transaction,
    );

    await repository.updateReceivable(
      receivable.idReceivable,
      {
        originalAmount: roundCurrency(
          paidInstallments.reduce((acc, installment) => acc + Number(installment.amount || 0), 0) +
            openAmount,
        ),
        openAmount,
        status: paidInstallments.length ? "PARTIAL" : "OPEN",
      },
      transaction,
    );

    await repository.updateSaleSummary(
      normalizedId,
      {
        paymentTypeId: mainPaymentType.id,
        installmentCount: newTotalInstallments,
        dueDate: newInstallments[0]?.dueDate || dueDate || sale.dueDate || null,
      },
      transaction,
    );

    await auditsRepository.createAudit(
      {
        auditTypeId: 5,
        userId,
        occurredAt,
        history: `RENEGOCIACAO da venda ${normalizedId} em ${new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(occurredAt)}.`,
        reason,
      },
      transaction,
    );
  });

  return {
    id: normalizedId,
    installmentCount: newTotalInstallments,
    openAmount,
    message: "Pagamento renegociado com sucesso.",
  };
}

async function deleteQuote(id) {
  const normalizedId = Number(id);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw createSalesValidationError("Venda invalida.");
  }

  const sale = await repository.getSaleForFinalization(normalizedId);
  validateEditableBudgetSale(sale);

  const deleted = await repository.deleteQuote(normalizedId);

  if (!deleted) {
    throw notFoundError("Venda nao encontrada.");
  }

  return {
    id: normalizedId,
    status: "DELETED",
    message: "Orçamento descartado com sucesso.",
  };
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

  return enrichSaleFinancialSummary(mapSaleDetails(sale));
}

async function listSales({ page, pageSize, status, search, customerId } = {}) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.min(100, Math.max(1, Number(pageSize) || 10));
  const normalizedSearch = search ? String(search).trim() : undefined;
  const normalizedStatus = status ? String(status).trim().toUpperCase() : undefined;
  const normalizedCustomerId =
    Number.isInteger(Number(customerId)) && Number(customerId) > 0
      ? Number(customerId)
      : undefined;
  const result = await repository.listSales({
    page: normalizedPage,
    pageSize: normalizedPageSize,
    status: normalizedStatus,
    search: normalizedSearch,
    customerId: normalizedCustomerId,
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
  cancelSaleItem,
  createSalesValidationError,
  createSale,
  createQuote,
  cancelSale,
  deleteQuote,
  finalizeSale,
  getSaleById,
  listSales,
  renegotiateSalePayment,
  updateQuote,
};
