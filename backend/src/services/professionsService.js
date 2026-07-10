const repository = require("../repositories/professionsRepository");
const { validationError, conflictError } = require("../errors/AppError");

async function getAllProfessions() {
  const professions = await repository.getAllProfessions();

  return professions.map((item) => ({
    id: Number(item.idProfession),
    name: item.nameProfession,
    desc: item.nameProfession,
  }));
}

function normalizeProfessionName(body = {}) {
  const name = String(body.name || body.desc || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!name) {
    throw validationError("Nome da profissao é obrigatório.");
  }

  return name;
}

async function createProfession(body = {}) {
  const name = normalizeProfessionName(body);

  const existing = await repository.findProfessionByName(name);

  if (existing) {
    throw conflictError("Profissao ja cadastrada.");
  }

  const created = await repository.createProfession({
    nameProfession: name,
  });

  return {
    id: Number(created.idProfession),
    name: created.nameProfession,
    desc: created.nameProfession,
  };
}

async function updateProfessionById(id, body = {}) {
  const professionId = Number(id);

  if (!Number.isInteger(professionId) || professionId <= 0) {
    throw validationError("Profissao invalida.");
  }

  const name = normalizeProfessionName(body);
  const existing = await repository.findProfessionByName(name);

  if (existing && Number(existing.idProfession) !== professionId) {
    throw conflictError("Profissao ja cadastrada.");
  }

  const updated = await repository.updateProfessionById(professionId, {
    nameProfession: name,
  });

  if (!updated) {
    return null;
  }

  return {
    id: Number(updated.idProfession),
    name: updated.nameProfession,
    desc: updated.nameProfession,
  };
}

async function deleteProfessionById(id) {
  const professionId = Number(id);

  if (!Number.isInteger(professionId) || professionId <= 0) {
    throw validationError("Profissao invalida.");
  }

  return repository.deleteProfessionById(professionId);
}

module.exports = {
  getAllProfessions,
  createProfession,
  updateProfessionById,
  deleteProfessionById,
};
