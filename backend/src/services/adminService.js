const repository = require("../repositories/adminRepository");
const { getAdminResourceConfig } = require("../utils/adminResourceConfig");
const {
  inferFinancialFlowFromKind,
  normalizeAllowedEntryPaymentKinds,
} = require("../utils/paymentTypeRules");

class AdminResourceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AdminResourceError";
    this.statusCode = statusCode;
  }
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
    throw new AdminResourceError("Recurso administrativo invalido.", 404);
  }

  const payload = {};

  for (const field of config.editableFields) {
    if (!(field in body)) continue;

    switch (field) {
      case "kind":
      case "financialFlow":
        payload[field] = normalizeText(body[field])?.toUpperCase() || null;
        break;
      case "document":
      case "zipCode":
      case "primaryPhone":
      case "secondaryPhone":
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
      case "requiresDueDate":
      case "allowsEntryAmount":
      case "allowsInstallments":
        payload[field] = Boolean(body[field]);
        break;
      case "allowedEntryPaymentKinds":
        payload[field] = normalizeAllowedEntryPaymentKinds(body[field]);
        break;
      case "maxInstallments":
      case "defaultInstallments":
        payload[field] =
          body[field] === "" || body[field] === null || body[field] === undefined
            ? null
            : Number(body[field]);
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
      throw new AdminResourceError("Descricao e obrigatoria.");
    }

    if (isCreate && !payload.kind) {
      throw new AdminResourceError("Tipo da forma de pagamento e obrigatorio.");
    }

    const allowedKinds = ["CASH", "CHECK", "BOOKLET", "INVOICE", "CARD"];
    if (payload.kind && !allowedKinds.includes(payload.kind)) {
      throw new AdminResourceError("Tipo da forma de pagamento invalido.");
    }

    payload.financialFlow = payload.financialFlow || inferFinancialFlowFromKind(payload.kind);

    const allowedFlows = ["IMMEDIATE_CASH", "FUTURE_CUSTOMER", "FUTURE_OPERATOR"];
    if (payload.financialFlow && !allowedFlows.includes(payload.financialFlow)) {
      throw new AdminResourceError("Fluxo financeiro invalido.");
    }

    if (payload.defaultInstallments === null || payload.defaultInstallments === undefined) {
      payload.defaultInstallments = 1;
    }

    if (!Number.isInteger(payload.defaultInstallments) || payload.defaultInstallments <= 0) {
      throw new AdminResourceError("Quantidade padrao de parcelas invalida.");
    }

    if (payload.maxInstallments !== null && payload.maxInstallments !== undefined) {
      if (!Number.isInteger(payload.maxInstallments) || payload.maxInstallments <= 0) {
        throw new AdminResourceError("Maximo de parcelas invalido.");
      }
    }

    if (payload.allowsInstallments) {
      payload.maxInstallments = payload.maxInstallments || payload.defaultInstallments;

      if (payload.defaultInstallments > payload.maxInstallments) {
        throw new AdminResourceError("Quantidade padrao nao pode ser maior que o maximo de parcelas.");
      }
    } else {
      payload.maxInstallments = 1;
      payload.defaultInstallments = 1;
    }

    if (payload.allowsEntryAmount) {
      if (!payload.allowedEntryPaymentKinds?.length) {
        payload.allowedEntryPaymentKinds = ["CASH", "CHECK"];
      }
    } else {
      payload.allowedEntryPaymentKinds = [];
    }

    return;
  }

  if (resource === "employees") {
    if (isCreate && !payload.fullName) {
      throw new AdminResourceError("Nome da funcionaria e obrigatorio.");
    }

    if (isCreate && !payload.shortName) {
      throw new AdminResourceError("Nome curto da funcionaria e obrigatorio.");
    }

    if (isCreate && !payload.roleId) {
      throw new AdminResourceError("Cargo da funcionaria e obrigatorio.");
    }
  } else if (isCreate && !payload.desc) {
    throw new AdminResourceError("Descricao e obrigatoria.");
  }
}

async function listResource(resource) {
  const records = await repository.listResource(resource);

  if (records === null) {
    throw new AdminResourceError("Recurso administrativo invalido.", 404);
  }

  return records;
}

async function createResource(resource, body) {
  const payload = sanitizePayload(resource, body);
  validatePayload(resource, payload, true);

  const created = await repository.createResource(resource, payload);
  if (created === null) {
    throw new AdminResourceError("Recurso administrativo invalido.", 404);
  }

  return created;
}

async function updateResource(resource, id, body) {
  const payload = sanitizePayload(resource, body);
  validatePayload(resource, payload, false);

  const updated = await repository.updateResource(resource, id, payload);

  if (updated === null) {
    throw new AdminResourceError("Recurso administrativo invalido.", 404);
  }

  if (updated === undefined) {
    throw new AdminResourceError("Registro nao encontrado.", 404);
  }

  return updated;
}

async function deleteResource(resource, id) {
  const removed = await repository.deleteResource(resource, id);

  if (removed === null) {
    throw new AdminResourceError("Recurso administrativo invalido.", 404);
  }

  if (removed === undefined) {
    throw new AdminResourceError("Registro nao encontrado.", 404);
  }

  return true;
}

module.exports = {
  AdminResourceError,
  listResource,
  createResource,
  updateResource,
  deleteResource,
};
