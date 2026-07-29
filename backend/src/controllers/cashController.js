const service = require("../services/cashService");

async function listCashEntriesController(req, res, next) {
  try {
    const data = await service.listEntries(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function createManualCashEntryController(req, res, next) {
  try {
    const data = await service.createManualEntry(req.body);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

async function listCashAccountOptionsController(req, res, next) {
  try {
    const data = await service.listAccountOptions(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function reverseCashEntryController(req, res, next) {
  try {
    const data = await service.reverseEntry(req.params.idCashEntry, req.user, req.body);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listCashEntriesController,
  listCashAccountOptionsController,
  createManualCashEntryController,
  reverseCashEntryController,
};
