const service = require("../services/salesService");

async function createSaleController(req, res, next) {
  try {
    const created = await service.createQuote(req.body);
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
}

async function listSalesController(req, res, next) {
  try {
    const data = await service.listSales(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function finalizeSaleController(req, res, next) {
  try {
    const finalized = await service.finalizeSale(req.params.id, req.body);
    return res.status(200).json(finalized);
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

async function cancelSaleController(req, res, next) {
  try {
    const data = await service.cancelSale(req.params.id);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  cancelSaleController,
  createSaleController,
  finalizeSaleController,
  getSaleByIdController,
  listSalesController,
};
