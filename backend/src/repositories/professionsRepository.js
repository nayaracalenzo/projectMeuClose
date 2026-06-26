const { Professions } = require('../models');

async function getAllProfessions() {
  return Professions.findAll({
    order: [['nameProfession', 'ASC']],
  });
}

module.exports = {
  getAllProfessions,
};
