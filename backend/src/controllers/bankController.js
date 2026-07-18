const service = require("../services/bankService");

async function listBankEntriesController(req, res, next) {
  try {
    const data = await service.listEntries(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function listBankAccountOptionsController(req, res, next) {
  try {
    const data = await service.listAccountOptions(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function createManualBankEntryController(req, res, next) {
  try {
    const data = await service.createManualEntry(req.body);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

async function reverseBankEntryController(req, res, next) {
  try {
    const data = await service.reverseEntry(req.params.idBankEntry, req.user, req.body);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

async function deleteBankEntryController(req, res, next) {
  try {
    const data = await service.deleteEntry(req.params.idBankEntry, req.user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listBankEntriesController,
  listBankAccountOptionsController,
  createManualBankEntryController,
  reverseBankEntryController,
  deleteBankEntryController,
};
