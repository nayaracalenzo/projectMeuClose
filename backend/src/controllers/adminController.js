const service = require("../services/adminService");

async function listResourceController(req, res) {
  try {
    const data = await service.listResource(req.params.resource);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

async function createResourceController(req, res) {
  try {
    const data = await service.createResource(req.params.resource, req.body);
    return res.status(201).json(data);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

async function updateResourceController(req, res) {
  try {
    const data = await service.updateResource(
      req.params.resource,
      Number(req.params.id),
      req.body
    );
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

async function deleteResourceController(req, res) {
  try {
    await service.deleteResource(req.params.resource, Number(req.params.id));
    return res.status(200).json({ message: "Registro removido com sucesso." });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = {
  listResourceController,
  createResourceController,
  updateResourceController,
  deleteResourceController,
};
