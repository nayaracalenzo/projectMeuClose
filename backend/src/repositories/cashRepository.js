const { Op } = require("sequelize");
const {
  CashEntries,
  FinancialCategories,
  PaymentReceipts,
  PayablePayments,
  ReceivableInstallments,
  Sales,
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
    ];
  }

  return where;
}

async function createEntry(payload, transaction) {
  return CashEntries.create(payload, { transaction });
}

async function getEntryById(idCashEntry, transaction) {
  return CashEntries.findByPk(idCashEntry, {
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
          of: CashEntries,
        }
      : undefined,
  });
}

async function findReversalByOriginId(reversalOfCashEntryId, transaction) {
  return CashEntries.findOne({
    where: {
      reversalOfCashEntryId,
    },
    transaction,
  });
}

async function findByTransferKey(transferKey, transaction) {
  if (!transferKey) return null;

  return CashEntries.findOne({
    where: {
      transferKey,
    },
    transaction,
  });
}

async function listEntriesBySaleId(saleId, transaction) {
  return CashEntries.findAll({
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
    order: [["occurredAt", "ASC"], ["idCashEntry", "ASC"]],
    transaction,
    lock: transaction
      ? {
          level: transaction.LOCK.UPDATE,
          of: CashEntries,
        }
      : undefined,
  });
}

async function listEntriesByPaymentReceiptId(paymentReceiptId, transaction) {
  return CashEntries.findAll({
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
    order: [["occurredAt", "ASC"], ["idCashEntry", "ASC"]],
    transaction,
    lock: transaction
      ? {
          level: transaction.LOCK.UPDATE,
          of: CashEntries,
        }
      : undefined,
  });
}

async function listEntries(filters = {}) {
  return CashEntries.findAndCountAll({
    where: buildWhere(filters),
    attributes: {
      include: [
        [
          sequelize.literal(`
            SUM(
              CASE
                WHEN "CashEntries"."movementType" = 'IN' THEN "CashEntries"."amount"
                ELSE -"CashEntries"."amount"
              END
            ) OVER (ORDER BY "CashEntries"."occurredAt" ASC, "CashEntries"."idCashEntry" ASC)
          `),
          "runningBalance",
        ],
        [
          sequelize.literal(`
            (
              SELECT pr."receiptType"
              FROM "payment_receipts" pr
              WHERE pr."idPaymentReceipt" = "CashEntries"."paymentReceiptId"
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
              WHERE pr."idPaymentReceipt" = "CashEntries"."paymentReceiptId"
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
              WHERE pr."idPaymentReceipt" = "CashEntries"."paymentReceiptId"
            )
          `),
          "totalInstallments",
        ],
        [
          sequelize.literal(`
            EXISTS (
              SELECT 1
              FROM "cash_entries" ce_reversal
              WHERE ce_reversal."reversalOfCashEntryId" = "CashEntries"."idCashEntry"
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
        model: PayablePayments,
        required: false,
        attributes: ["idPayablePayment"],
      },
    ],
    order: [["occurredAt", "DESC"], ["idCashEntry", "DESC"]],
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize,
  });
}

async function summarizeEntries(filters = {}) {
  const [summary] = await CashEntries.findAll({
    where: buildWhere(filters),
    attributes: [
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN "CashEntries"."movementType" = 'IN' THEN "CashEntries"."amount" ELSE 0 END`),
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
            sequelize.literal(`CASE WHEN "CashEntries"."movementType" = 'OUT' THEN "CashEntries"."amount" ELSE 0 END`),
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
  listEntriesBySaleId,
  listEntriesByPaymentReceiptId,
  listEntries,
  summarizeEntries,
};
