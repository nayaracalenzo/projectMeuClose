const { logger, serializeError } = require("../utils/logger");
const service = require("../services/receivablesService");

async function listReceivablesController(req, res) {
  try {
    const data = await service.listInstallments(req.query);
    return res.status(200).json(data);
  } catch (error) {
    logger.error("receivablesController.listReceivablesController failed", {
      operation: "listReceivablesController",
      ...serializeError(error),
    });
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

async function registerReceiptController(req, res) {
  try {
    const data = await service.registerReceipt(req.params.installmentId, req.body);
    return res.status(201).json(data);
  } catch (error) {
    logger.error("receivablesController.registerReceiptController failed", {
      operation: "registerReceiptController",
      installmentId: req.params?.installmentId || null,
      ...serializeError(error),
    });
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = {
  listReceivablesController,
  registerReceiptController,
};
