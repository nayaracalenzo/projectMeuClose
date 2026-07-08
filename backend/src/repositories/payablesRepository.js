const { Op } = require("sequelize");
const { PayablePayments, Payables, PaymentTypes, Suppliers, sequelize } = require("../models");
const { createBankEntry, createCashEntry } = require("../services/financialEntriesService");

function buildWhere({ scope, status, startDate, endDate } = {}) {
  const where = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  if (scope) {
    where.scope = scope;
  }

  if (startDate || endDate) {
    where.dueDate = {};

    if (startDate) {
      where.dueDate[Op.gte] = startDate;
    }

    if (endDate) {
      where.dueDate[Op.lte] = endDate;
    }
  }

  switch (status) {
    case "EM_ABERTO":
      where.status = {
        [Op.ne]: "PAID",
      };
      break;
    case "PAGAS":
      where.status = "PAID";
      break;
    case "ATRASADAS":
      where.status = {
        [Op.ne]: "PAID",
      };
      where.dueDate = {
        ...(where.dueDate || {}),
        [Op.lt]: today,
      };
      break;
    case "VENCE_HOJE":
      where.status = {
        [Op.ne]: "PAID",
      };
      where.dueDate = {
        ...(where.dueDate || {}),
        [Op.gte]: today,
        [Op.lte]: endOfToday,
      };
      break;
    case "A_VENCER":
      where.status = {
        [Op.ne]: "PAID",
      };
      where.dueDate = {
        ...(where.dueDate || {}),
        [Op.gt]: endOfToday,
      };
      break;
    default:
      break;
  }

  return where;
}

function buildInclude() {
  return [
    {
      model: Suppliers,
      attributes: ["idSupplier", "fullName", "tradeName"],
      required: false,
    },
    {
      model: PaymentTypes,
      attributes: ["idPaymentType", "desc"],
      required: false,
    },
  ];
}

async function listPayables({ scope, status, startDate, endDate, page, pageSize } = {}) {
  return Payables.findAndCountAll({
    where: buildWhere({ scope, status, startDate, endDate }),
    include: [
      ...buildInclude(),
    ],
    order: [["dueDate", "DESC"], ["createdAt", "DESC"]],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    distinct: true,
  });
}

async function summarizePayables({ scope, status, startDate, endDate } = {}) {
  const [summary] = await Payables.findAll({
    where: buildWhere({ scope, status, startDate, endDate }),
    attributes: [
      [sequelize.fn("COALESCE", sequelize.fn("SUM", sequelize.col("Payables.amount")), 0), "totalAmount"],
      [sequelize.fn("COALESCE", sequelize.fn("SUM", sequelize.col("Payables.openAmount")), 0), "totalOpen"],
    ],
    raw: true,
  });

  return {
    totalAmount: Number(summary?.totalAmount || 0),
    totalOpen: Number(summary?.totalOpen || 0),
  };
}

async function createPayable(payload) {
  return Payables.create(payload);
}

async function getSupplierById(supplierId) {
  return Suppliers.findByPk(supplierId);
}

async function getPayableById(payableId) {
  return Payables.findByPk(payableId);
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

    if (payload.financialMovement) {
      const movementPayload = {
        ...payload.financialMovement,
        payablePaymentId: payment.idPayablePayment,
      };

      if (payload.financialMovement.target === "CAIXA") {
        await createCashEntry(movementPayload, transaction);
      } else {
        await createBankEntry(movementPayload, transaction);
      }
    }

    return {
      payable,
      payment,
    };
  });
}

module.exports = {
  listPayables,
  summarizePayables,
  createPayable,
  getSupplierById,
  getPayableById,
  registerPayment,
};
