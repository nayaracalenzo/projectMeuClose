const { Professions } = require('../models');

async function getAllProfessions() {
  return Professions.findAll({
    order: [['nameProfession', 'ASC']],
  });
}

async function findProfessionByName(nameProfession) {
  return Professions.findOne({
    where: {
      nameProfession,
    },
  });
}

async function createProfession(payload) {
  return Professions.create(payload);
}

async function getProfessionById(idProfession) {
  return Professions.findByPk(idProfession);
}

async function updateProfessionById(idProfession, payload) {
  const profession = await getProfessionById(idProfession);

  if (!profession) {
    return null;
  }

  await profession.update(payload);
  return profession;
}

async function deleteProfessionById(idProfession) {
  const deletedCount = await Professions.destroy({
    where: {
      idProfession,
    },
  });

  return deletedCount > 0;
}

module.exports = {
  getAllProfessions,
  findProfessionByName,
  createProfession,
  getProfessionById,
  updateProfessionById,
  deleteProfessionById,
};
