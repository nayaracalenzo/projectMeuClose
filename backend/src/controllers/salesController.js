const service = require("../services/salesService");

async function createSaleController(req, res, next) {
  try {
    const created = await service.createSale(req.body);
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
}

async function getSaleByIdController(req, res, next) {
  try {
    const data = await service.getSaleById(req.params.id);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createSaleController,
  getSaleByIdController,
};
