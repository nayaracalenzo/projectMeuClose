const repository = require("../repositories/clientsRepository.js");
const employeesRepository = require("../repositories/employeesRepository.js");
const { validationError } = require("../errors/AppError");
const { normalizeDateToLocalMidnight } = require("../utils/normalizeDate.js");
const { LEGACY_MEASUREMENT_DEFINITIONS } = require("../utils/measurementDefinitions");
const {
  normalizeClientInput,
  validateClientPayload,
} = require("../utils/clientValidation.js");
const {
  parseBirthdayFilters,
  getCurrentWeekBirthdayWindow,
  getBirthdayOccurrenceTimestamp,
  isBirthdayInWindow,
  sortBirthdays,
} = require("./birthdayService.js");

const LEGACY_MEASUREMENT_KEYS = new Set(
  LEGACY_MEASUREMENT_DEFINITIONS.map((item) => item.key),
);

function normalizeMeasurementValue(value, label) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(String(value).replace(",", "."));

  if (!Number.isFinite(normalized)) {
    throw validationError(`Medida ${label} invalida.`, {
      name: "ClientValidationError",
      code: "CLIENT_VALIDATION_ERROR",
    });
  }

  return Number(normalized.toFixed(2));
}

function buildClientMeasurements({
  definitions = [],
  masterRecord = null,
  dynamicRows = [],
}) {
  const latestValueByKey = new Map();

  dynamicRows.forEach((row) => {
    const definition = row.MeasurementDefinition || row.MeasurementDefinitions || null;
    const key = String(definition?.key || "").trim();

    if (!key || latestValueByKey.has(key)) {
      return;
    }

    latestValueByKey.set(
      key,
      row.value === null || row.value === undefined ? null : Number(row.value),
    );
  });

  return definitions.map((definition) => {
    const key = String(definition.key || "").trim();
    const masterValue =
      masterRecord && key in masterRecord.dataValues
        ? masterRecord.get(key)
        : null;
    const dynamicValue = latestValueByKey.get(key);
    const value =
      dynamicValue !== undefined && dynamicValue !== null
        ? dynamicValue
        : masterValue === null || masterValue === undefined
          ? null
          : Number(masterValue);

    return {
      measurementDefinitionId: Number(definition.idMeasurementDefinition),
      key,
      label: String(definition.label || key),
      value,
    };
  });
}

function toClientDetails(client) {
  if (!client) return null;

  return {
    id: client.idCustomer,
    typeCustomer: client.typeCustomer,
    document: client.document,
    rg: client.rg,
    fullName: client.fullName,
    birthDate: client.birthDate,
    companyName: client.companyName,
    tradeName: client.tradeName,
    phone: client.phone,
    email: client.email,
    zipCode: client.zipCode,
    street: client.street,
    number: client.number,
    complement: client.complement,
    neighborhood: client.neighborhood,
    city: client.city,
    state: client.state,
    active: client.active,
    blocked: client.blocked,
    professionId: client.professionId,
    professionName:
      client.Profession?.nameProfession ||
      client.Professions?.nameProfession ||
      null,
    comment: client.comment,
    measurements: Array.isArray(client.measurements) ? client.measurements : [],
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

function buildClientDetailsFromPayload(id, payload, existingClient = null) {
  return {
    id,
    typeCustomer: payload.typeCustomer,
    document: payload.document,
    rg: payload.rg,
    fullName: payload.fullName,
    birthDate: payload.birthDate,
    companyName: payload.companyName,
    tradeName: payload.tradeName,
    phone: payload.phone,
    email: payload.email,
    zipCode: payload.zipCode,
    street: payload.street,
    number: payload.number,
    complement: payload.complement,
    neighborhood: payload.neighborhood,
    city: payload.city,
    state: payload.state,
    active: payload.active,
    blocked: payload.blocked,
    professionId: payload.professionId,
    professionName: existingClient?.Profession?.nameProfession || null,
    comment: payload.comment,
    createdAt: existingClient?.createdAt || null,
    updatedAt: existingClient?.updatedAt || null,
  };
}

function isUniqueConstraintError(error) {
  return error?.name === "SequelizeUniqueConstraintError";
}

function getSequelizeValidationMessage(error) {
  if (error?.name !== "SequelizeValidationError" && error?.name !== "SequelizeDatabaseError") {
    return null;
  }

  const firstIssue = Array.isArray(error?.errors) ? error.errors[0] : null;
  const field = String(firstIssue?.path || error?.path || "").trim();
  const message = String(firstIssue?.message || error?.message || "").trim();

  if (field && message) {
    return `${field}: ${message}`;
  }

  if (message) {
    return message;
  }

  return "Dados do cliente invalidos.";
}

async function getBirthdaysOfMonth(query) {
  const filters = parseBirthdayFilters(query);

  const [customers, employees] = await Promise.all([
    repository.findBirthdays(filters),
    employeesRepository.findBirthdays(filters),
  ]);

  return [...customers, ...employees]
    .map((person) => ({
      id: person.idCustomer ?? person.idEmployee,
      fullName: person.fullName,
      birthDate: person.birthDate,
      source: person.idCustomer ? "customer" : "employee",
    }))
    .sort(sortBirthdays);
}

async function getBirthdaysOfWeek() {
  const { startDate, endDate } = getCurrentWeekBirthdayWindow();
  const months = new Set([startDate.getMonth() + 1, endDate.getMonth() + 1]);

  const monthlyResults = await Promise.all(
    [...months].map(async (month) => {
      const filters = { month, year: null };
      const [customers, employees] = await Promise.all([
        repository.findBirthdays(filters),
        employeesRepository.findBirthdays(filters),
      ]);

      return [...customers, ...employees];
    }),
  );

  const referenceYears = [startDate.getFullYear(), endDate.getFullYear()];

  return monthlyResults
    .flat()
    .map((person) => ({
      id: person.idCustomer ?? person.idEmployee,
      fullName: person.fullName,
      birthDate: person.birthDate,
      source: person.idCustomer ? "customer" : "employee",
    }))
    .filter((person) => isBirthdayInWindow(person.birthDate, startDate, endDate))
    .sort((left, right) => {
      const leftTimestamp = Math.min(
        ...referenceYears.map((year) =>
          getBirthdayOccurrenceTimestamp(left.birthDate, year),
        ),
      );
      const rightTimestamp = Math.min(
        ...referenceYears.map((year) =>
          getBirthdayOccurrenceTimestamp(right.birthDate, year),
        ),
      );

      if (leftTimestamp !== rightTimestamp) {
        return leftTimestamp - rightTimestamp;
      }

      return left.fullName.localeCompare(right.fullName, "pt-BR");
    });
}

async function getAllClients(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
  const search = query.search ? String(query.search).trim() : undefined;
  const status = query.status ? String(query.status).trim().toLowerCase() : undefined;
  const result = await repository.getAllClients({
    search,
    status,
    page,
    pageSize,
  });

  return {
    items: result.rows.map((client) => ({
      id: client.idCustomer,
      fullName: client.fullName,
      typeCustomer: client.typeCustomer,
      companyName: client.companyName,
      document: client.document,
      rg: client.rg,
      phone: client.phone,
      email: client.email,
      city: client.city,
      state: client.state,
      active: client.active,
      blocked: client.blocked,
    })),
    total: Number(result.count || 0),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(result.count || 0) / pageSize)),
  };
}

async function getClientById(id) {
  const client = await repository.getClientById(id);
  if (!client) return null;

  const [definitions, masterRecord, dynamicRows] = await Promise.all([
    repository.listMeasurementDefinitions(),
    repository.getLatestCustomerMeasurementsRecord(client.idCustomer),
    repository.listLatestMeasurementValuesByCustomerId(client.idCustomer),
  ]);

  client.setDataValue(
    "measurements",
    buildClientMeasurements({
      definitions,
      masterRecord,
      dynamicRows,
    }),
  );

  return toClientDetails(client);
}

function buildClientPayload(body, { isCreate }) {
  const normalizedBody = normalizeClientInput(body);
  validateClientPayload(normalizedBody);

  return {
    typeCustomer: normalizedBody.typeCustomer,
    document: normalizedBody.document,
    rg: normalizedBody.rg,
    fullName: normalizedBody.fullName,
    birthDate: normalizeDateToLocalMidnight(normalizedBody.birthDate),
    companyName: normalizedBody.companyName,
    tradeName: normalizedBody.tradeName,
    phone: normalizedBody.phone ?? "",
    email: normalizedBody.email,
    zipCode: normalizedBody.zipCode,
    street: normalizedBody.street,
    number: normalizedBody.number,
    complement: normalizedBody.complement,
    neighborhood: normalizedBody.neighborhood,
    city: normalizedBody.city,
    state: normalizedBody.state,
    active: isCreate ? normalizedBody.active ?? true : normalizedBody.active,
    blocked: isCreate ? normalizedBody.blocked ?? false : normalizedBody.blocked,
    professionId: normalizedBody.professionId,
    comment: normalizedBody.comment,
  };
}

async function updateClientById(id, body) {
  const currentClient = await repository.getClientById(id, { includeBlocked: true });
  if (!currentClient) return null;

  const payload = buildClientPayload(body, { isCreate: false });
  const isSoftDeleting = currentClient.blocked !== true && payload.blocked === true;

  if (isSoftDeleting) {
    const hasOpenReceivables = await repository.hasOpenReceivablesByCustomerId(
      currentClient.idCustomer,
    );

    if (hasOpenReceivables) {
      throw validationError(
        "Não é possível excluir o cliente porque existem valores em aberto.",
        {
          name: "ClientValidationError",
          code: "CLIENT_VALIDATION_ERROR",
        },
      );
    }
  }

  let updated;
  try {
    updated = await repository.updateClientById(id, payload);
  } catch (error) {
    if (payload.document && isUniqueConstraintError(error)) {
      throw validationError("CPF/CNPJ ja cadastrado.", {
        name: "ClientValidationError",
        code: "CLIENT_VALIDATION_ERROR",
      });
    }

    const validationMessage = getSequelizeValidationMessage(error);
    if (validationMessage) {
      throw validationError(validationMessage, {
        name: "ClientValidationError",
        code: "CLIENT_VALIDATION_ERROR",
      });
    }

    throw error;
  }
  if (!updated) return null;

  return getClientById(id);
}

async function createClient(body) {
  const payload = buildClientPayload(body, { isCreate: true });
  const existingClient = payload.document
    ? await repository.findClientByDocument(payload.document)
    : null;

  if (existingClient && existingClient.blocked !== true) {
    throw validationError("CPF/CNPJ ja cadastrado.", {
      name: "ClientValidationError",
      code: "CLIENT_VALIDATION_ERROR",
    });
  }

  if (existingClient) {
    const reactivatedPayload = {
      ...payload,
      active: true,
      blocked: false,
    };

    await repository.updateClientById(existingClient.idCustomer, reactivatedPayload);

    return (
      (await getClientById(existingClient.idCustomer)) ||
      buildClientDetailsFromPayload(existingClient.idCustomer, reactivatedPayload, existingClient)
    );
  }

  try {
    const created = await repository.createClient(payload);
    return getClientById(created.idCustomer);
  } catch (error) {
    if (payload.document && isUniqueConstraintError(error)) {
      throw validationError("CPF/CNPJ ja cadastrado.", {
        name: "ClientValidationError",
        code: "CLIENT_VALIDATION_ERROR",
      });
    }

    const validationMessage = getSequelizeValidationMessage(error);
    if (validationMessage) {
      throw validationError(validationMessage, {
        name: "ClientValidationError",
        code: "CLIENT_VALIDATION_ERROR",
      });
    }

    throw error;
  }
}

async function updateClientMeasurements(id, body = {}) {
  const currentClient = await repository.getClientById(id, { includeBlocked: true });
  if (!currentClient) return null;

  const definitions = await repository.listMeasurementDefinitions();
  const definitionById = new Map(
    definitions.map((item) => [Number(item.idMeasurementDefinition), item]),
  );
  const measurements = Array.isArray(body.measurements) ? body.measurements : [];
  const legacyFields = {};
  const dynamicValues = [];

  for (const measurement of measurements) {
    const measurementDefinitionId = Number(measurement?.measurementDefinitionId || 0);
    const definition = definitionById.get(measurementDefinitionId);

    if (!definition) {
      throw validationError("Medida invalida.", {
        name: "ClientValidationError",
        code: "CLIENT_VALIDATION_ERROR",
      });
    }

    const key = String(definition.key || "").trim();
    const value = normalizeMeasurementValue(measurement?.value, definition.label || key);

    if (LEGACY_MEASUREMENT_KEYS.has(key)) {
      legacyFields[key] = value;
    }

    if (value !== null) {
      dynamicValues.push({
        measurementDefinitionId,
        value,
      });
    }
  }

  await repository.saveClientMeasurements(currentClient.idCustomer, {
    legacyFields,
    dynamicValues,
  });

  return getClientById(currentClient.idCustomer);
}

module.exports = {
  getBirthdaysOfMonth,
  getBirthdaysOfWeek,
  getAllClients,
  getClientById,
  updateClientById,
  updateClientMeasurements,
  createClient,
};
