const { PaymentTypes } = require("../models");

async function listPaymentTypes() {
  return PaymentTypes.findAll({
    where: { active: true },
    order: [["idPaymentType", "ASC"]],
  });
}

async function listAllPaymentTypes() {
  return PaymentTypes.findAll({
    order: [["idPaymentType", "ASC"]],
  });
}

async function getPaymentTypeById(idPaymentType) {
  return PaymentTypes.findByPk(idPaymentType);
}

module.exports = {
  listPaymentTypes,
  listAllPaymentTypes,
  getPaymentTypeById,
};
