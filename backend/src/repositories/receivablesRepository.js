const {
  CardTransactions,
  Customers,
  PaymentReceipts,
  PaymentTypes,
  ReceivableInstallments,
  Receivables,
  Sales,
  sequelize,
} = require("../models");

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

async function listInstallments() {
  return ReceivableInstallments.findAll({
    include: [
      {
        model: Receivables,
        include: [
          { model: Customers, attributes: ["idCustomer", "fullName", "companyName"] },
          { model: Sales, attributes: ["idSale"] },
          { model: CardTransactions, attributes: ["operatorLabel"], required: false },
        ],
      },
      {
        model: PaymentTypes,
        attributes: ["idPaymentType", "desc"],
        required: false,
      },
      {
        model: PaymentReceipts,
        attributes: ["idPaymentReceipt", "saleId", "amount", "paidAt", "referenceCode"],
        required: false,
      },
    ],
    order: [["dueDate", "ASC"], ["installmentNumber", "ASC"]],
  });
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
  registerReceipt,
};
