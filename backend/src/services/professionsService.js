const repository = require('../repositories/professionsRepository');

async function getAllProfessions() {
  const professions = await repository.getAllProfessions();

  return professions.map((item) => ({
    id: Number(item.idProfession),
    name: item.nameProfession,
  }));
}

module.exports = {
  getAllProfessions,
};
