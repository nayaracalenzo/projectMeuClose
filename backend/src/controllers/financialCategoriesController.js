const service = require("../services/financialCategoriesService");

async function listFinancialCategoriesController(_req, res, next) {
  try {
    const data = await service.listFinancialCategories();
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listFinancialCategoriesController,
};
