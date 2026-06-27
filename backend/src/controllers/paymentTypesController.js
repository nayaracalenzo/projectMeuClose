const service = require("../services/paymentTypesService");

async function listPaymentTypesController(_req, res, next) {
  try {
    const data = await service.listPaymentTypes();
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPaymentTypesController,
};
