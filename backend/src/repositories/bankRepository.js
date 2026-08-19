const { Op, Sequelize } = require("sequelize");
const {
  BankEntries,
  FinancialAccounts,
  FinancialCategories,
  PaymentReceipts,
  PaymentTypes,
  PayablePayments,
  ReceivableInstallments,
  Sales,
  sequelize,
} = require("../models");

function buildWhere({ scope, search, startDate, endDate, accountLabel, financialCategoryId } = {}) {
  const where = {};

  if (scope) {
    where.scope = scope;
  }

  if (startDate || endDate) {
    where.occurredAt = {};

    if (startDate) {
      where.occurredAt[Op.gte] = startDate;
    }

    if (endDate) {
      where.occurredAt[Op.lte] = endDate;
    }
  }

  if (search) {
    where[Op.or] = [
      {
        description: {
          [Op.iLike]: `%${search}%`,
        },
      },
      {
        "$FinancialCategory.description$": {
          [Op.iLike]: `%${search}%`,
        },
      },
      {
        accountLabel: {
          [Op.iLike]: `%${search}%`,
        },
      },
    ];
  }

  if (accountLabel) {
    where.accountLabel = {
      [Op.iLike]: accountLabel,
    };
  }

  if (financialCategoryId) {
    where.financialCategoryId = financialCategoryId;
  }

  return where;
}

async function createEntry(payload, transaction) {
  return BankEntries.create(payload, { transaction });
}

async function getEntryById(idBankEntry, transaction) {
  return BankEntries.findByPk(idBankEntry, {
    include: [
      {
        model: FinancialCategories,
        attributes: ["idFinancialCategory", "description"],
      },
      {
        model: Sales,
        attributes: ["idSale", "status"],
        required: false,
      },
    ],
    transaction,
    lock: transaction
      ? {
          level: transaction.LOCK.UPDATE,
          of: BankEntries,
        }
      : undefined,
  });
}

async function findReversalByOriginId(reversalOfBankEntryId, transaction) {
  return BankEntries.findOne({
    where: {
      reversalOfBankEntryId,
    },
    transaction,
  });
}

async function findByTransferKey(transferKey, transaction) {
  if (!transferKey) return null;

  return BankEntries.findOne({
    where: {
      transferKey,
    },
    transaction,
  });
}

async function listEntriesBySaleId(saleId, transaction) {
  return BankEntries.findAll({
    where: {
      saleId,
    },
    include: [
      {
        model: FinancialCategories,
        required: false,
        attributes: ["idFinancialCategory", "description"],
      },
      {
        model: Sales,
        required: false,
        attributes: ["idSale", "status"],
      },
    ],
    order: [["occurredAt", "ASC"], ["idBankEntry", "ASC"]],
    transaction,
    lock: transaction
      ? {
          level: transaction.LOCK.UPDATE,
          of: BankEntries,
        }
      : undefined,
  });
}

async function listEntriesByPaymentReceiptId(paymentReceiptId, transaction) {
  return BankEntries.findAll({
    where: {
      paymentReceiptId,
    },
    include: [
      {
        model: FinancialCategories,
        required: false,
        attributes: ["idFinancialCategory", "description"],
      },
      {
        model: Sales,
        required: false,
        attributes: ["idSale", "status"],
      },
    ],
    order: [["occurredAt", "ASC"], ["idBankEntry", "ASC"]],
    transaction,
    lock: transaction
      ? {
          level: transaction.LOCK.UPDATE,
          of: BankEntries,
        }
      : undefined,
  });
}

async function deleteEntry(entry, transaction) {
  return entry.destroy({ transaction });
}

async function listAccountOptions(scope) {
  const where = {
    active: true,
    dsbl: false,
    targetType: "BANK",
  };

  if (scope) {
    where.scope = scope;
  }

  const rows = await FinancialAccounts.findAll({
    where,
    order: [["desc", "ASC"]],
  });

  return rows
    .map((item) => String(item.desc || "").trim())
    .filter(Boolean);
}

async function listEntries(filters = {}) {
  const runningBalancePartition = filters.accountLabel
    ? `AND COALESCE(be_balance."accountLabel", '') = COALESCE("BankEntries"."accountLabel", '')`
    : "";

  return BankEntries.findAndCountAll({
    where: buildWhere(filters),
    attributes: {
      include: [
        [
          sequelize.literal(`
            (
              SELECT COALESCE(
                SUM(
                  CASE
                    WHEN be_balance."movementType" = 'IN' THEN be_balance."amount"
                    ELSE -be_balance."amount"
                  END
                ),
                0
              )
              FROM "bank_entries" be_balance
              WHERE be_balance.scope = "BankEntries".scope
                ${runningBalancePartition}
                AND (
                  be_balance."occurredAt" < "BankEntries"."occurredAt"
                  OR (
                    be_balance."occurredAt" = "BankEntries"."occurredAt"
                    AND be_balance."idBankEntry" <= "BankEntries"."idBankEntry"
                  )
                )
            )
          `),
          "runningBalance",
        ],
        [
          sequelize.literal(`
            (
              SELECT pr."receiptType"
              FROM "payment_receipts" pr
              WHERE pr."idPaymentReceipt" = "BankEntries"."paymentReceiptId"
            )
          `),
          "receiptType",
        ],
        [
          sequelize.literal(`
            (
              SELECT ri."installmentNumber"
              FROM "payment_receipts" pr
              LEFT JOIN "receivable_installments" ri
                ON ri."idReceivableInstallment" = pr."receivableInstallmentId"
              WHERE pr."idPaymentReceipt" = "BankEntries"."paymentReceiptId"
            )
          `),
          "installmentNumber",
        ],
        [
          sequelize.literal(`
            (
              SELECT ri."totalInstallments"
              FROM "payment_receipts" pr
              LEFT JOIN "receivable_installments" ri
                ON ri."idReceivableInstallment" = pr."receivableInstallmentId"
              WHERE pr."idPaymentReceipt" = "BankEntries"."paymentReceiptId"
            )
          `),
          "totalInstallments",
        ],
        [
          sequelize.literal(`
            EXISTS (
              SELECT 1
              FROM "bank_entries" be_reversal
              WHERE be_reversal."reversalOfBankEntryId" = "BankEntries"."idBankEntry"
            )
          `),
          "hasReversal",
        ],
      ],
    },
    include: [
      {
        model: FinancialCategories,
        required: false,
        attributes: ["idFinancialCategory", "description"],
      },
      {
        model: Sales,
        required: false,
        attributes: ["idSale", "status"],
      },
      {
        model: PaymentReceipts,
        required: false,
        attributes: ["idPaymentReceipt", "receiptType", "receivableInstallmentId"],
        include: [
          {
            model: ReceivableInstallments,
            required: false,
            attributes: ["installmentNumber", "totalInstallments"],
          },
        ],
      },
      {
        model: PaymentTypes,
        required: false,
        attributes: ["idPaymentType", "desc"],
      },
      {
        model: PayablePayments,
        required: false,
        attributes: ["idPayablePayment"],
      },
    ],
    order: [["occurredAt", "DESC"], ["idBankEntry", "DESC"]],
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize,
  });
}

async function summarizeEntries(filters = {}) {
  const [summary] = await BankEntries.findAll({
    where: buildWhere(filters),
    include: [
      {
        model: FinancialCategories,
        required: false,
        attributes: [],
      },
    ],
    attributes: [
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN "BankEntries"."movementType" = 'IN' THEN "BankEntries"."amount" ELSE 0 END`),
          ),
          0,
        ),
        "totalIn",
      ],
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN "BankEntries"."movementType" = 'OUT' THEN "BankEntries"."amount" ELSE 0 END`),
          ),
          0,
        ),
        "totalOut",
      ],
    ],
    raw: true,
  });

  return {
    totalIn: Number(summary?.totalIn || 0),
    totalOut: Number(summary?.totalOut || 0),
  };
}

async function getBalanceBeforeDate({ scope, accountLabel, beforeDate } = {}) {
  if (!beforeDate) {
    return 0;
  }

  const where = {
    occurredAt: {
      [Op.lt]: beforeDate,
    },
  };

  if (scope) {
    where.scope = scope;
  }

  if (accountLabel) {
    where.accountLabel = {
      [Op.iLike]: accountLabel,
    };
  }

  const [summary] = await BankEntries.findAll({
    where,
    attributes: [
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN "BankEntries"."movementType" = 'IN' THEN "BankEntries"."amount" ELSE -"BankEntries"."amount" END`,
            ),
          ),
          0,
        ),
        "balance",
      ],
    ],
    raw: true,
  });

  return Number(summary?.balance || 0);
}

module.exports = {
  createEntry,
  getEntryById,
  findReversalByOriginId,
  findByTransferKey,
  listEntriesBySaleId,
  listEntriesByPaymentReceiptId,
  deleteEntry,
  listAccountOptions,
  listEntries,
  summarizeEntries,
  getBalanceBeforeDate,
};
