const service = require("../services/professionsService");

async function getAllProfessions(_req, res, next) {
  try {
    const professions = await service.getAllProfessions();
    return res.status(200).json(professions);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAllProfessions,
};
