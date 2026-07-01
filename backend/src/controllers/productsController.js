const service = require("../services/productsService");

async function listProductsController(req, res, next) {
  try {
    const data = await service.listProducts(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function listProductStatusesController(_req, res, next) {
  try {
    const data = await service.listProductStatuses();
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function getProductByIdController(req, res, next) {
  try {
    const data = await service.getProductById(req.params.id);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function updateProductByIdController(req, res, next) {
  try {
    const data = await service.updateProductById(req.params.id, req.body);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getProductByIdController,
  listProductsController,
  listProductStatusesController,
  updateProductByIdController,
};
