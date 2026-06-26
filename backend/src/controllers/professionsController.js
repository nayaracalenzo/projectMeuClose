const service = require('../services/professionsService');

async function getAllProfessions(_req, res) {
  try {
    const professions = await service.getAllProfessions();
    return res.status(200).json(professions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  getAllProfessions,
};
