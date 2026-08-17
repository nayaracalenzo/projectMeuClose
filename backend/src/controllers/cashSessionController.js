const service = require("../services/cashSessionService");

async function getStoreSessionStatusController(req, res, next) {
  try {
    const data = await service.getStoreSessionStatus(
      req.query.referenceDate ?? req.query.occurredAt ?? null,
    );
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function openStoreSessionController(req, res, next) {
  try {
    const data = await service.openStoreSession(req.body, req.user);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

async function closeCurrentStoreSessionController(req, res, next) {
  try {
    const data = await service.closeCurrentStoreSession(req.body, req.user);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function rolloverStoreSessionController(req, res, next) {
  try {
    const data = await service.rolloverStoreSession(req.body, req.user);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getStoreSessionStatusController,
  openStoreSessionController,
  closeCurrentStoreSessionController,
  rolloverStoreSessionController,
};
