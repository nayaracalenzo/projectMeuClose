const service = require("../services/productsService");

async function listProductsController(req, res, next) {
  try {
    const data = await service.listProducts(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listProductsController,
};
