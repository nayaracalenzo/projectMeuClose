const service = require("../services/saleDraftsService");

async function getActiveSaleDraftController(req, res, next) {
  try {
    const data = await service.getActiveSaleDraft(req.user);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function upsertActiveSaleDraftController(req, res, next) {
  try {
    const data = await service.upsertActiveSaleDraft(req.user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function discardActiveSaleDraftController(req, res, next) {
  try {
    const data = await service.discardActiveSaleDraft(req.user);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  discardActiveSaleDraftController,
  getActiveSaleDraftController,
  upsertActiveSaleDraftController,
};
