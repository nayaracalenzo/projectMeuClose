const crypto = require("crypto");
const {
  Audits,
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
      Sequelize.where(
        Sequelize.fn(
          "CONCAT",
          Sequelize.cast(Sequelize.col("ReceivableInstallments.installmentNumber"), "TEXT"),
          "/",
          Sequelize.cast(Sequelize.col("ReceivableInstallments.totalInstallments"), "TEXT"),
        ),
        {
          [Op.iLike]: term,
        },
      ),
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
  const saleReceiptAttributes = summary ? [] : ["idPaymentReceipt", "receiptType"];
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
        {
          model: Sales,
          attributes: baseAttributes,
          include: summary
            ? []
            : [
                {
                  model: PaymentReceipts,
                  attributes: saleReceiptAttributes,
                  required: false,
                },
              ],
        },
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

function buildStandaloneReceiptsWhere({ startDate, endDate, search } = {}) {
  const where = {
    receivableInstallmentId: null,
    receiptType: {
      [Op.in]: ["SALE_FULL", "ENTRY"],
    },
  };

  if (startDate || endDate) {
    where.paidAt = {};
    if (startDate) {
      where.paidAt[Op.gte] = startDate;
    }
    if (endDate) {
      where.paidAt[Op.lte] = endDate;
    }
  }

  if (search) {
    const term = `%${search}%`;
    where[Op.or] = [
      Sequelize.where(Sequelize.cast(Sequelize.col("PaymentReceipts.saleId"), "TEXT"), {
        [Op.iLike]: term,
      }),
      {
        "$PaymentType.desc$": {
          [Op.iLike]: term,
        },
      },
      {
        "$Sale.Customer.fullName$": {
          [Op.iLike]: term,
        },
      },
      {
        "$Sale.Customer.companyName$": {
          [Op.iLike]: term,
        },
      },
      {
        referenceCode: {
          [Op.iLike]: term,
        },
      },
    ];
  }

  return where;
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
  const query = {
    where,
    include: buildReceivablesInclude({ customerId }),
    order: [["dueDate", "ASC"], ["installmentNumber", "ASC"]],
    distinct: true,
    subQuery: false,
  };

  if (Number.isInteger(pageSize) && pageSize > 0) {
    query.limit = pageSize;
  }

  if (
    Number.isInteger(page) &&
    page > 0 &&
    Number.isInteger(pageSize) &&
    pageSize > 0
  ) {
    query.offset = (page - 1) * pageSize;
  }

  return ReceivableInstallments.findAndCountAll(query);
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
            sequelize.literal(`
              CASE
                WHEN "ReceivableInstallments"."status" = 'PAID' THEN 0
                ELSE "ReceivableInstallments"."amount" - "ReceivableInstallments"."paidAmount"
              END
            `),
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

async function listStandaloneReceipts({ startDate, endDate, search, customerId } = {}) {
  const saleWhere =
    customerId && Number(customerId) > 0
      ? {
          customerId: Number(customerId),
        }
      : undefined;

  return PaymentReceipts.findAll({
    where: buildStandaloneReceiptsWhere({ startDate, endDate, search }),
    include: [
      {
        model: Sales,
        required: true,
        where: saleWhere,
        include: [
          {
            model: Customers,
            attributes: ["idCustomer", "fullName", "companyName"],
          },
        ],
      },
      {
        model: PaymentTypes,
        attributes: ["idPaymentType", "desc"],
        required: false,
      },
    ],
    order: [["paidAt", "DESC"], ["idPaymentReceipt", "DESC"]],
  });
}

async function summarizeStandaloneReceipts({ startDate, endDate, search, customerId } = {}) {
  const saleWhere =
    customerId && Number(customerId) > 0
      ? {
          customerId: Number(customerId),
        }
      : undefined;

  const [totals] = await PaymentReceipts.findAll({
    where: buildStandaloneReceiptsWhere({ startDate, endDate, search }),
    include: [
      {
        model: Sales,
        required: true,
        where: saleWhere,
        attributes: [],
        include: [
          {
            model: Customers,
            attributes: [],
          },
        ],
      },
      {
        model: PaymentTypes,
        attributes: [],
        required: false,
      },
    ],
    attributes: [
      [sequelize.fn("COALESCE", sequelize.fn("SUM", sequelize.col("PaymentReceipts.amount")), 0), "totalReceived"],
    ],
    raw: true,
  });

  return {
    totalReceived: Number(totals?.totalReceived || 0),
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
        interestBaseDate:
          payload.discardInterest && installmentStatus !== "PAID"
            ? payload.paidAt
            : installment.interestBaseDate || installment.dueDate,
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

async function getCustomerById(customerId) {
  return Customers.findByPk(customerId);
}

async function getInstallmentById(installmentId) {
  return ReceivableInstallments.findByPk(installmentId, {
    include: [
      {
        model: Receivables,
        include: [
          {
            model: Customers,
            attributes: ["idCustomer", "fullName", "companyName"],
            required: false,
          },
        ],
      },
      {
        model: PaymentReceipts,
        attributes: ["idPaymentReceipt"],
        required: false,
      },
      {
        model: PaymentTypes,
        attributes: ["idPaymentType", "desc"],
        required: false,
      },
    ],
  });
}

async function createManualReceivable(payload) {
  return sequelize.transaction(async (transaction) => {
    const receivable = await Receivables.create(
      {
        saleId: null,
        customerId: payload.customerId,
        supplierId: null,
        debtorType: "CUSTOMER",
        operatorLabel: null,
        originalAmount: payload.amount,
        openAmount: payload.amount,
        status: "OPEN",
      },
      { transaction },
    );

    const installment = await ReceivableInstallments.create(
      {
        receivableId: receivable.idReceivable,
        paymentTypeId: payload.paymentTypeId,
        installmentNumber: 1,
        totalInstallments: 1,
        dueDate: payload.dueDate,
        interestBaseDate: payload.dueDate,
        amount: payload.amount,
        paidAmount: 0,
        status: "OPEN",
      },
      { transaction },
    );

    return {
      receivable,
      installment,
    };
  });
}

async function updateManualReceivable(installmentId, payload) {
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

    if (!installment || !installment.Receivable) {
      return undefined;
    }

    await installment.update(
      {
        paymentTypeId: payload.paymentTypeId,
        dueDate: payload.dueDate,
        interestBaseDate: payload.dueDate,
        amount: payload.amount,
        status: "OPEN",
      },
      { transaction },
    );

    await installment.update(
      {
        paidAmount: 0,
      },
      { transaction },
    );

    await installment.Receivable.update(
      {
        customerId: payload.customerId,
        originalAmount: payload.amount,
        openAmount: payload.amount,
        status: "OPEN",
      },
      { transaction },
    );

    return {
      receivable: installment.Receivable,
      installment,
    };
  });
}

async function deleteManualReceivable(installmentId, auditPayload) {
  return sequelize.transaction(async (transaction) => {
    const installment = await ReceivableInstallments.findByPk(installmentId, {
      include: [
        {
          model: Receivables,
          include: [
            {
              model: Customers,
              attributes: ["idCustomer", "fullName", "companyName"],
              required: false,
            },
          ],
        },
        {
          model: PaymentReceipts,
          attributes: ["idPaymentReceipt"],
          required: false,
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!installment || !installment.Receivable) {
      return undefined;
    }

    await Audits.create(
      {
        auditTypeId: auditPayload.auditTypeId,
        userId: auditPayload.userId,
        occurredAt: auditPayload.occurredAt,
        history: auditPayload.history,
        reason: auditPayload.reason || null,
        legacyFingerprint: crypto
          .createHash("sha256")
          .update(
            JSON.stringify({
              installmentId,
              occurredAt: auditPayload.occurredAt.toISOString(),
              history: auditPayload.history,
              userId: auditPayload.userId || null,
            }),
          )
          .digest("hex"),
      },
      { transaction },
    );

    await installment.Receivable.destroy({ transaction });

    return {
      installmentId,
    };
  });
}

module.exports = {
  createReceivableWithInstallments,
  createStandaloneReceipt,
  getCustomerById,
  getInstallmentById,
  listInstallments,
  summarizeInstallments,
  listStandaloneReceipts,
  summarizeStandaloneReceipts,
  createManualReceivable,
  updateManualReceivable,
  deleteManualReceivable,
  registerReceipt,
};
