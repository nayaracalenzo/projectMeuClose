const { Op, Sequelize } = require("sequelize");
const {
  BankEntries,
  FinancialCategories,
  PaymentReceipts,
  PayablePayments,
  ReceivableInstallments,
  sequelize,
} = require("../models");

function buildWhere({ scope, search, startDate, endDate } = {}) {
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

async function listAccountOptions(scope) {
  const where = {
    accountLabel: {
      [Op.not]: null,
    },
  };

  if (scope) {
    where.scope = scope;
  }

  const rows = await BankEntries.findAll({
    where,
    attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("accountLabel")), "accountLabel"]],
    order: [["accountLabel", "ASC"]],
    raw: true,
  });

  return rows
    .map((item) => String(item.accountLabel || "").trim())
    .filter(Boolean);
}

async function listEntries(filters = {}) {
  return BankEntries.findAndCountAll({
    where: buildWhere(filters),
    attributes: {
      include: [
        [
          sequelize.literal(`
            SUM(
              CASE
                WHEN "BankEntries"."movementType" = 'IN' THEN "BankEntries"."amount"
                ELSE -"BankEntries"."amount"
              END
            ) OVER (ORDER BY "BankEntries"."occurredAt" ASC, "BankEntries"."idBankEntry" ASC)
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
      ],
    },
    include: [
      {
        model: FinancialCategories,
        required: false,
        attributes: ["idFinancialCategory", "description"],
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

module.exports = {
  createEntry,
  getEntryById,
  findReversalByOriginId,
  findByTransferKey,
  listAccountOptions,
  listEntries,
  summarizeEntries,
};
