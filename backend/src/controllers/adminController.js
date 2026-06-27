const service = require("../services/adminService");

async function listResourceController(req, res, next) {
  try {
    const data = await service.listResource(req.params.resource);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function createResourceController(req, res, next) {
  try {
    const data = await service.createResource(req.params.resource, req.body);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

async function updateResourceController(req, res, next) {
  try {
    const data = await service.updateResource(
      req.params.resource,
      Number(req.params.id),
      req.body,
    );
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function deleteResourceController(req, res, next) {
  try {
    await service.deleteResource(req.params.resource, Number(req.params.id));
    return res.status(200).json({ message: "Registro removido com sucesso." });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listResourceController,
  createResourceController,
  updateResourceController,
  deleteResourceController,
};
