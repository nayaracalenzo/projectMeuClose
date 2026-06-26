const { PayablePayments, Payables, PaymentTypes, sequelize } = require("../models");

async function listPayables() {
  return Payables.findAll({
    include: [
      {
        model: PaymentTypes,
        attributes: ["idPaymentType", "desc"],
        required: false,
      },
      {
        model: PayablePayments,
        attributes: ["idPayablePayment", "amount", "paidAt", "referenceCode"],
        required: false,
      },
    ],
    order: [["dueDate", "ASC"], ["createdAt", "DESC"]],
  });
}

async function createPayable(payload) {
  return Payables.create(payload);
}

async function registerPayment(payableId, payload) {
  return sequelize.transaction(async (transaction) => {
    const payable = await Payables.findByPk(payableId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!payable) {
      return undefined;
    }

    const payment = await PayablePayments.create(
      {
        payableId: payable.idPayable,
        paymentTypeId: payload.paymentTypeId,
        amount: payload.amount,
        paidAt: payload.paidAt,
        referenceCode: payload.referenceCode,
      },
      { transaction }
    );

    const nextOpenAmount = Math.max(0, Number(payable.openAmount) - Number(payload.amount));
    const nextStatus =
      nextOpenAmount === 0 ? "PAID" : nextOpenAmount < Number(payable.amount) ? "PARTIAL" : "OPEN";

    await payable.update(
      {
        openAmount: nextOpenAmount,
        status: nextStatus,
      },
      { transaction }
    );

    return {
      payable,
      payment,
    };
  });
}

module.exports = {
  listPayables,
  createPayable,
  registerPayment,
};
