const { logger, serializeError } = require("../utils/logger");
const service = require('../services/professionsService');

async function getAllProfessions(_req, res) {
  try {
    const professions = await service.getAllProfessions();
    return res.status(200).json(professions);
  } catch (error) {
    logger.error("professionsController.getAllProfessions failed", {
      operation: "getAllProfessions",
      ...serializeError(error),
    });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  getAllProfessions,
};
