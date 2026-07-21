const { CustomerCredits, CustomerCreditUsages } = require("../models");
const { Op } = require("sequelize");

async function createCustomerCredit(payload, transaction) {
  return CustomerCredits.create(payload, { transaction });
}

async function listCreditsBySaleId(saleId, transaction) {
  return CustomerCredits.findAll({
    where: {
      saleId,
      status: {
        [Op.ne]: "CANCELLED",
      },
    },
    order: [["createdAt", "DESC"], ["idCustomerCredit", "DESC"]],
    transaction,
  });
}

async function listActiveCreditsByCustomerId(customerId, transaction) {
  return CustomerCredits.findAll({
    where: {
      customerId,
      status: "ACTIVE",
      balanceAmount: {
        [Op.gt]: 0,
      },
    },
    order: [["createdAt", "ASC"], ["idCustomerCredit", "ASC"]],
    transaction,
  });
}

async function sumActiveCreditBalanceByCustomerId(customerId, transaction) {
  const rows = await listActiveCreditsByCustomerId(customerId, transaction);
  return rows.reduce((acc, item) => acc + Number(item.balanceAmount || 0), 0);
}

async function createCustomerCreditUsage(payload, transaction) {
  return CustomerCreditUsages.create(payload, { transaction });
}

async function listCreditUsagesBySaleId(saleId, transaction) {
  return CustomerCreditUsages.findAll({
    where: {
      saleId,
    },
    include: [
      {
        model: CustomerCredits,
        required: true,
      },
    ],
    order: [["createdAt", "ASC"], ["idCustomerCreditUsage", "ASC"]],
    transaction,
  });
}

module.exports = {
  createCustomerCredit,
  listCreditsBySaleId,
  listActiveCreditsByCustomerId,
  sumActiveCreditBalanceByCustomerId,
  createCustomerCreditUsage,
  listCreditUsagesBySaleId,
};
