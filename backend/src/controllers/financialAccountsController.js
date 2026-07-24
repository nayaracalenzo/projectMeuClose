const service = require("../services/financialAccountsService");

async function listFinancialAccountOptionsController(req, res, next) {
  try {
    const data = await service.listOptions(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listFinancialAccountOptionsController,
};
