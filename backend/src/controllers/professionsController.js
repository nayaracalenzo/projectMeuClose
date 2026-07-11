const { notFoundError } = require("../errors/AppError");
const service = require("../services/professionsService");

async function getAllProfessions(_req, res, next) {
  try {
    const professions = await service.getAllProfessions();
    return res.status(200).json(professions);
  } catch (error) {
    return next(error);
  }
}

async function createProfession(req, res, next) {
  try {
    const created = await service.createProfession(req.body);
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
}

async function updateProfession(req, res, next) {
  try {
    const updated = await service.updateProfessionById(req.params.id, req.body);

    if (!updated) {
      throw notFoundError("Profissão nao encontrada.");
    }

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
}

async function deleteProfession(req, res, next) {
  try {
    const deleted = await service.deleteProfessionById(req.params.id);

    if (!deleted) {
      throw notFoundError("Profissão nao encontrada.");
    }

    return res.status(200).json({ message: "Profissão removida com sucesso." });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAllProfessions,
  createProfession,
  updateProfession,
  deleteProfession,
};
