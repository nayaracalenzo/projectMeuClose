const { logger, serializeError } = require("../utils/logger");
const service = require("../services/payablesService");

async function listPayablesController(req, res) {
  try {
    const data = await service.listPayables(req.query);
    return res.status(200).json(data);
  } catch (error) {
    logger.error("payablesController.listPayablesController failed", {
      operation: "listPayablesController",
      ...serializeError(error),
    });
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

async function createPayableController(req, res) {
  try {
    const data = await service.createPayable(req.body);
    return res.status(201).json(data);
  } catch (error) {
    logger.error("payablesController.createPayableController failed", {
      operation: "createPayableController",
      ...serializeError(error),
    });
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

async function registerPayablePaymentController(req, res) {
  try {
    const data = await service.registerPayment(req.params.payableId, req.body);
    return res.status(201).json(data);
  } catch (error) {
    logger.error("payablesController.registerPayablePaymentController failed", {
      operation: "registerPayablePaymentController",
      payableId: req.params?.payableId || null,
      ...serializeError(error),
    });
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = {
  listPayablesController,
  createPayableController,
  registerPayablePaymentController,
};
