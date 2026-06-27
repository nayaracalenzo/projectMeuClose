const service = require("../services/receivablesService");

async function listReceivablesController(req, res, next) {
  try {
    const data = await service.listInstallments(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function registerReceiptController(req, res, next) {
  try {
    const data = await service.registerReceipt(req.params.installmentId, req.body);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listReceivablesController,
  registerReceiptController,
};
