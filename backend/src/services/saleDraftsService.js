const { validationError } = require("../errors/AppError");
const repository = require("../repositories/saleDraftsRepository");

function createSaleDraftValidationError(message) {
  return validationError(message, {
    name: "SaleDraftValidationError",
  });
}

function normalizeUserId(user) {
  const normalized = Number(user?.id ?? user?.idUser);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw createSaleDraftValidationError("Usuario invalido para salvar o rascunho.");
  }

  return normalized;
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createSaleDraftValidationError("Payload do rascunho invalido.");
  }

  return payload;
}

function normalizeOptionalDate(value) {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function mapDraftResponse(draft) {
  if (!draft) return null;

  return {
    id: draft.idSaleDraft,
    status: draft.status,
    payload: draft.payload || {},
    lastClientSavedAt: draft.lastClientSavedAt || null,
    lastServerSavedAt: draft.lastServerSavedAt || null,
    createdAt: draft.createdAt || null,
    updatedAt: draft.updatedAt || null,
  };
}

async function getActiveSaleDraft(user) {
  const userId = normalizeUserId(user);
  const draft = await repository.findActiveByUserId(userId);
  return mapDraftResponse(draft);
}

async function upsertActiveSaleDraft(user, body = {}) {
  const userId = normalizeUserId(user);
  const payload = normalizePayload(body.payload);
  const lastClientSavedAt = normalizeOptionalDate(body.lastClientSavedAt);
  const lastServerSavedAt = new Date();

  const draft = await repository.upsertActiveByUserId(
    userId,
    {
      status: "ACTIVE",
      payload,
      lastClientSavedAt,
      lastServerSavedAt,
    },
  );

  return mapDraftResponse(draft);
}

async function discardActiveSaleDraft(user) {
  const userId = normalizeUserId(user);
  const deletedCount = await repository.deleteActiveByUserId(userId);

  return {
    deleted: deletedCount > 0,
  };
}

module.exports = {
  discardActiveSaleDraft,
  getActiveSaleDraft,
  upsertActiveSaleDraft,
};
