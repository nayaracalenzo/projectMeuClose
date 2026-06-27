const service = require("../services/payablesService");

async function listPayablesController(req, res, next) {
  try {
    const data = await service.listPayables(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function createPayableController(req, res, next) {
  try {
    const data = await service.createPayable(req.body);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

async function registerPayablePaymentController(req, res, next) {
  try {
    const data = await service.registerPayment(req.params.payableId, req.body);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPayablesController,
  createPayableController,
  registerPayablePaymentController,
};
