const service = require("../services/receivablesService");

async function listReceivablesController(req, res, next) {
  try {
    const data = await service.listInstallments(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function createReceivableController(req, res, next) {
  try {
    const data = await service.createReceivable(req.body);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

async function updateReceivableController(req, res, next) {
  try {
    const data = await service.updateReceivable(req.params.installmentId, req.body);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function deleteReceivableController(req, res, next) {
  try {
    const data = await service.deleteReceivable(req.params.installmentId, req.user);
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
  createReceivableController,
  updateReceivableController,
  deleteReceivableController,
  registerReceiptController,
};
