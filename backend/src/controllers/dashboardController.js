const service = require("../services/dashboardService");

async function getDashboardSummaryController(_req, res, next) {
  try {
    const data = await service.getDashboardSummary();
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function listPurchasePendingsController(_req, res, next) {
  try {
    const data = await service.listPurchasePendings();
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function createPurchasePendingController(req, res, next) {
  try {
    const data = await service.createPurchasePending(req.body);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

async function updatePurchasePendingController(req, res, next) {
  try {
    const data = await service.updatePurchasePending(req.params.id, req.body);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function deletePurchasePendingController(req, res, next) {
  try {
    const data = await service.deletePurchasePending(req.params.id);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getDashboardSummaryController,
  listPurchasePendingsController,
  createPurchasePendingController,
  updatePurchasePendingController,
  deletePurchasePendingController,
};
