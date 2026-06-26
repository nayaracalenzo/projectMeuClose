const { logger, serializeError } = require("../utils/logger");
const service = require("../services/salesService");

async function createSaleController(req, res) {
  try {
    const created = await service.createSale(req.body);
    return res.status(201).json(created);
  } catch (error) {
    logger.error("salesController.createSaleController failed", {
      operation: "createSaleController",
      ...serializeError(error),
    });
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
}

module.exports = {
  createSaleController,
};
