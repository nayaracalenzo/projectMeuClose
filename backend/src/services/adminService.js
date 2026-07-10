const { notFoundError, validationError } = require("../errors/AppError");
const repository = require("../repositories/adminRepository");
const { getAdminResourceConfig } = require("../utils/adminResourceConfig");

function createAdminResourceError(message, statusCode = 400) {
  return validationError(message, {
    name: "AdminResourceError",
    code: "ADMIN_RESOURCE_ERROR",
    statusCode,
  });
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

function normalizeBoolean(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return null;
}

function normalizeDate(value) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function sanitizePayload(resource, body = {}) {
  const config = getAdminResourceConfig(resource);
  if (!config) {
    throw notFoundError("Recurso administrativo invalido.");
  }

  const payload = {};

  for (const field of config.editableFields) {
    if (!(field in body)) continue;

    switch (field) {
      case "document":
      case "zipCode":
      case "primaryPhone":
      case "secondaryPhone":
      case "phoneCommercial1":
      case "phoneCommercial2":
      case "fax":
      case "phoneMobile":
        payload[field] = normalizeDigits(body[field]);
        break;
      case "email":
        payload[field] = normalizeText(body[field])?.toLowerCase() || null;
        break;
      case "birthDate":
        payload[field] = normalizeDate(body[field]);
        break;
      case "roleId":
        payload[field] =
          body[field] === "" || body[field] === null || body[field] === undefined
            ? null
            : Number(body[field]);
        break;
      case "active":
      case "blocked":
        payload[field] = normalizeBoolean(body[field]);
        break;
      default:
        payload[field] = normalizeText(body[field]);
        break;
    }
  }

  return payload;
}

function validatePayload(resource, payload, isCreate) {
  if (resource === "payment-types") {
    if (isCreate && !payload.desc) {
      throw createAdminResourceError("Descricao e obrigatoria.");
    }
    if (!isCreate && "desc" in payload && !payload.desc) {
      throw createAdminResourceError("Descricao e obrigatoria.");
    }
    return;
  }

  if (resource === "suppliers") {
    if (isCreate && !payload.fullName) {
      throw createAdminResourceError("Nome do fornecedor e obrigatorio.");
    }
    if (!isCreate && "fullName" in payload && !payload.fullName) {
      throw createAdminResourceError("Nome do fornecedor e obrigatorio.");
    }
    return;
  }

  if (resource === "employees") {
    if (isCreate && !payload.fullName) {
      throw createAdminResourceError("Nome da funcionaria e obrigatorio.");
    }

    if (isCreate && !payload.shortName) {
      throw createAdminResourceError("Nome curto da funcionaria e obrigatorio.");
    }

    if (isCreate && !payload.roleId) {
      throw createAdminResourceError("Cargo da funcionaria e obrigatorio.");
    }
  } else if (isCreate && !payload.desc) {
    throw createAdminResourceError("Descricao e obrigatoria.");
  }
}

async function listResource(resource) {
  const records = await repository.listResource(resource);

  if (records === null) {
    throw notFoundError("Recurso administrativo invalido.");
  }

  return records;
}

async function createResource(resource, body) {
  const payload = sanitizePayload(resource, body);
  validatePayload(resource, payload, true);

  const created = await repository.createResource(resource, payload);
  if (created === null) {
    throw notFoundError("Recurso administrativo invalido.");
  }

  return created;
}

async function updateResource(resource, id, body) {
  const payload = sanitizePayload(resource, body);
  validatePayload(resource, payload, false);

  const updated = await repository.updateResource(resource, id, payload);

  if (updated === null) {
    throw notFoundError("Recurso administrativo invalido.");
  }

  if (updated === undefined) {
    throw notFoundError("Registro nao encontrado.");
  }

  return updated;
}

async function deleteResource(resource, id) {
  const removed = await repository.deleteResource(resource, id);

  if (removed === null) {
    throw notFoundError("Recurso administrativo invalido.");
  }

  if (removed === undefined) {
    throw notFoundError("Registro nao encontrado.");
  }

  return true;
}

module.exports = {
  createAdminResourceError,
  listResource,
  createResource,
  updateResource,
  deleteResource,
};
