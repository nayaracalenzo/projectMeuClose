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

module.exports = {
  listBankEntriesController,
  listBankAccountOptionsController,
};
