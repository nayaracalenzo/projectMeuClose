const { SaleDrafts } = require("../models");

async function findActiveByUserId(userId, transaction) {
  return SaleDrafts.findOne({
    where: {
      userId,
      status: "ACTIVE",
    },
    order: [["updatedAt", "DESC"], ["idSaleDraft", "DESC"]],
    transaction,
  });
}

async function upsertActiveByUserId(userId, payload, transaction) {
  const existingDraft = await findActiveByUserId(userId, transaction);

  if (existingDraft) {
    return existingDraft.update(payload, { transaction });
  }

  return SaleDrafts.create(
    {
      userId,
      ...payload,
    },
    { transaction },
  );
}

async function deleteActiveByUserId(userId, transaction) {
  return SaleDrafts.destroy({
    where: {
      userId,
      status: "ACTIVE",
    },
    transaction,
  });
}

module.exports = {
  deleteActiveByUserId,
  findActiveByUserId,
  upsertActiveByUserId,
};
