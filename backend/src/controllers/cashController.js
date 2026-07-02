const service = require("../services/cashService");

async function listCashEntriesController(req, res, next) {
  try {
    const data = await service.listEntries(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listCashEntriesController,
};
