const {
  CardTransactions,
  Customers,
  PaymentReceipts,
  PaymentTypes,
  ReceivableInstallments,
  Receivables,
  Sales,
  Sequelize,
  Suppliers,
  sequelize,
} = require("../models");
const { createBankEntry, createCashEntry } = require("../services/financialEntriesService");
const { Op } = require("sequelize");

async function createReceivableWithInstallments({ receivable, installments, cardTransaction }, transaction) {
  const createdReceivable = await Receivables.create(receivable, { transaction });

  const createdInstallments = await ReceivableInstallments.bulkCreate(
    installments.map((item) => ({
      ...item,
      receivableId: createdReceivable.idReceivable,
    })),
    { transaction }
  );

  const createdCardTransaction = cardTransaction
    ? await CardTransactions.create(
        {
          ...cardTransaction,
          receivableId: createdReceivable.idReceivable,
        },
        { transaction }
      )
    : null;

  return {
    receivable: createdReceivable,
    installments: createdInstallments,
    cardTransaction: createdCardTransaction,
  };
}

async function createStandaloneReceipt(payload, transaction) {
  return PaymentReceipts.create(payload, { transaction });
}

function buildInstallmentsWhere({ startDate, endDate, search } = {}) {
  const where = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  if (startDate || endDate) {
    where.dueDate = {};

    if (startDate) {
      where.dueDate[Op.gte] = startDate;
    }

    if (endDate) {
      where.dueDate[Op.lte] = endDate;
    }
  }

  if (search) {
    const term = `%${search}%`;
    where[Op.or] = [
      Sequelize.where(Sequelize.cast(Sequelize.col("ReceivableInstallments.installmentNumber"), "TEXT"), {
        [Op.iLike]: term,
      }),
      Sequelize.where(Sequelize.cast(Sequelize.col("ReceivableInstallments.totalInstallments"), "TEXT"), {
        [Op.iLike]: term,
      }),
      {
        "$PaymentType.desc$": {
          [Op.iLike]: term,
        },
      },
      {
        "$Receivable.Customer.fullName$": {
          [Op.iLike]: term,
        },
      },
      {
        "$Receivable.Customer.companyName$": {
          [Op.iLike]: term,
        },
      },
      {
        "$Receivable.Supplier.fullName$": {
          [Op.iLike]: term,
        },
      },
      {
        "$Receivable.Supplier.tradeName$": {
          [Op.iLike]: term,
        },
      },
      {
        "$Receivable.CardTransaction.operatorLabel$": {
          [Op.iLike]: term,
        },
      },
      {
        "$Receivable.operatorLabel$": {
          [Op.iLike]: term,
        },
      },
    ];
  }

  return where;
}

function buildStatusWhere(status, currentWhere = {}) {
  const where = { ...currentWhere };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  const dueDate = { ...(where.dueDate || {}) };

  switch (status) {
    case "A_RECEBER":
      where.status = {
        [Op.ne]: "PAID",
      };
      break;
    case "RECEBIDAS":
      where.status = "PAID";
      break;
    case "ATRASADAS":
      where.status = {
        [Op.ne]: "PAID",
      };
      dueDate[Op.lt] = today;
      where.dueDate = dueDate;
      break;
    case "VENCE_HOJE":
      where.status = {
        [Op.ne]: "PAID",
      };
      dueDate[Op.gte] = today;
      dueDate[Op.lte] = endOfToday;
      where.dueDate = dueDate;
      break;
    case "A_VENCER":
      where.status = {
        [Op.ne]: "PAID",
      };
      dueDate[Op.gt] = endOfToday;
      where.dueDate = dueDate;
      break;
    default:
      break;
  }

  return where;
}

function buildReceivablesInclude({ customerId, summary = false } = {}) {
  const baseAttributes = summary ? [] : ["idSale"];
  const customerAttributes = summary ? [] : ["idCustomer", "fullName", "companyName"];
  const supplierAttributes = summary ? [] : ["idSupplier", "fullName", "tradeName"];
  const cardTransactionAttributes = summary ? [] : ["operatorLabel"];
  const paymentTypeAttributes = summary ? [] : ["idPaymentType", "desc"];

  return [
    {
      model: Receivables,
      attributes: summary ? [] : undefined,
      where:
        customerId && Number(customerId) > 0
          ? {
              customerId: Number(customerId),
            }
          : undefined,
      include: [
        { model: Customers, attributes: customerAttributes },
        { model: Suppliers, attributes: supplierAttributes, required: false },
        { model: Sales, attributes: baseAttributes },
        { model: CardTransactions, attributes: cardTransactionAttributes, required: false },
      ],
    },
    {
      model: PaymentTypes,
      attributes: paymentTypeAttributes,
      required: false,
    },
  ];
}

async function listInstallments({
  page,
  pageSize,
  startDate,
  endDate,
  search,
  status,
  customerId,
} = {}) {
  const where = buildStatusWhere(status, buildInstallmentsWhere({ startDate, endDate, search }));

  return ReceivableInstallments.findAndCountAll({
    where,
    include: buildReceivablesInclude({ customerId }),
    order: [["dueDate", "ASC"], ["installmentNumber", "ASC"]],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    distinct: true,
  });
}

async function summarizeInstallments({ startDate, endDate, search, status, customerId } = {}) {
  const where = buildStatusWhere(status, buildInstallmentsWhere({ startDate, endDate, search }));

  const [totals] = await ReceivableInstallments.findAll({
    where,
    include: buildReceivablesInclude({ customerId, summary: true }),
    attributes: [
      [sequelize.fn("COALESCE", sequelize.fn("SUM", sequelize.col("ReceivableInstallments.paidAmount")), 0), "totalReceived"],
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn(
            "SUM",
            sequelize.literal('"ReceivableInstallments"."amount" - "ReceivableInstallments"."paidAmount"'),
          ),
          0,
        ),
        "totalOpen",
      ],
    ],
    raw: true,
  });

  return {
    totalReceived: Number(totals?.totalReceived || 0),
    totalOpen: Number(totals?.totalOpen || 0),
  };
}

async function registerReceipt(installmentId, payload) {
  return sequelize.transaction(async (transaction) => {
    const installment = await ReceivableInstallments.findByPk(installmentId, {
      include: [
        {
          model: Receivables,
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!installment) {
      return undefined;
    }

    const receipt = await PaymentReceipts.create(
      {
        saleId: installment.Receivable?.saleId,
        receivableInstallmentId: installment.idReceivableInstallment,
        paymentTypeId: payload.paymentTypeId,
        receiptType: "INSTALLMENT",
        amount: payload.amount,
        paidAt: payload.paidAt,
        referenceCode: payload.referenceCode,
      },
      { transaction }
    );

    const nextPaidAmount = Number(installment.paidAmount) + Number(payload.amount);
    const installmentAmount = Number(installment.amount);
    const installmentStatus =
      nextPaidAmount >= installmentAmount ? "PAID" : nextPaidAmount > 0 ? "PARTIAL" : "OPEN";

    await installment.update(
      {
        paidAmount: nextPaidAmount,
        paymentTypeId: payload.paymentTypeId,
        status: installmentStatus,
      },
      { transaction }
    );

    const receivable = installment.Receivable;
    const nextOpenAmount = Math.max(0, Number(receivable.openAmount) - Number(payload.amount));
    const receivableStatus =
      nextOpenAmount === 0 ? "PAID" : nextOpenAmount < Number(receivable.originalAmount) ? "PARTIAL" : "OPEN";

    await receivable.update(
      {
        openAmount: nextOpenAmount,
        status: receivableStatus,
      },
      { transaction }
    );

    if (payload.financialMovement) {
      const movementPayload = {
        ...payload.financialMovement,
        saleId: installment.Receivable?.saleId || null,
        paymentReceiptId: receipt.idPaymentReceipt,
      };

      if (payload.financialMovement.target === "CASH") {
        await createCashEntry(movementPayload, transaction);
      } else {
        await createBankEntry(movementPayload, transaction);
      }
    }

    return {
      receipt,
      installment,
      receivable,
    };
  });
}

module.exports = {
  createReceivableWithInstallments,
  createStandaloneReceipt,
  listInstallments,
  summarizeInstallments,
  registerReceipt,
};
