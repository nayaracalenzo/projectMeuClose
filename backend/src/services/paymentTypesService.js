const repository = require("../repositories/paymentTypesRepository");
const { buildPaymentTypeResponse } = require("../utils/paymentTypeRules");

async function listPaymentTypes() {
  const paymentTypes = await repository.listPaymentTypes();
  return paymentTypes.map(buildPaymentTypeResponse);
}

async function getPaymentTypeById(idPaymentType) {
  const paymentType = await repository.getPaymentTypeById(idPaymentType);
  return paymentType ? buildPaymentTypeResponse(paymentType) : null;
}

module.exports = {
  listPaymentTypes,
  getPaymentTypeById,
};
