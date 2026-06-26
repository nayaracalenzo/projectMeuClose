const { logger, serializeError } = require("../utils/logger");
const service = require("../services/paymentTypesService");

async function listPaymentTypesController(_req, res) {
  try {
    const data = await service.listPaymentTypes();
    return res.status(200).json(data);
  } catch (error) {
    logger.error("paymentTypesController.listPaymentTypesController failed", {
      operation: "listPaymentTypesController",
      ...serializeError(error),
    });
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
}

module.exports = {
  listPaymentTypesController,
};
