const service = require("../services/transfersService");

async function transferStoreCashToBankController(req, res, next) {
  try {
    const data = await service.transferStoreCashToBank(req.body);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  transferStoreCashToBankController,
};
