class ClientValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ClientValidationError";
    this.statusCode = 400;
  }
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? digits : null;
}

function normalizeClientInput(body = {}) {
  return {
    typeCustomer: normalizeText(body.typeCustomer),
    document: normalizeDigits(body.document),
    rg: normalizeText(body.rg),
    fullName: normalizeText(body.fullName),
    birthDate: body.birthDate,
    companyName: normalizeText(body.companyName),
    tradeName: normalizeText(body.tradeName),
    phone: normalizeDigits(body.phone),
    email: normalizeText(body.email),
    zipCode: normalizeDigits(body.zipCode),
    street: normalizeText(body.street),
    number: normalizeText(body.number),
    complement: normalizeText(body.complement),
    neighborhood: normalizeText(body.neighborhood),
    city: normalizeText(body.city),
    state: normalizeText(body.state)?.toUpperCase() || null,
    active: typeof body.active === "boolean" ? body.active : body.active,
    blocked: typeof body.blocked === "boolean" ? body.blocked : body.blocked,
    professionId:
      body.professionId === undefined ||
      body.professionId === null ||
      body.professionId === ""
        ? null
        : Number(body.professionId),
    comment: normalizeText(body.comment),
  };
}

function getClientValidationIssues(payload) {
  const issues = [];

  if (!payload.typeCustomer) {
    issues.push("Tipo do cliente e obrigatorio.");
    return issues;
  }

  if (payload.typeCustomer !== "INDIVIDUAL" && payload.typeCustomer !== "COMPANY") {
    issues.push("Tipo do cliente invalido.");
  }

  if (!payload.phone) {
    issues.push("Telefone e obrigatorio.");
  }

  if (!payload.document) {
    issues.push(
      payload.typeCustomer === "COMPANY"
        ? "CNPJ é obrigatório."
        : "CPF é obrigatório."
    );
  } else if (payload.typeCustomer === "INDIVIDUAL" && payload.document.length !== 11) {
    issues.push("CPF deve conter 11 digitos.");
  } else if (payload.typeCustomer === "COMPANY" && payload.document.length !== 14) {
    issues.push("CNPJ deve conter 14 digitos.");
  }

  if (payload.typeCustomer === "INDIVIDUAL" && !payload.fullName) {
    issues.push("Nome completo e obrigatorio para pessoa fisica.");
  }

  if (payload.typeCustomer === "COMPANY" && !payload.companyName) {
    issues.push("Razao social e obrigatoria para pessoa juridica.");
  }

  return issues;
}

function validateClientPayload(payload) {
  const issues = getClientValidationIssues(payload);

  if (issues.length) {
    throw new ClientValidationError(issues[0]);
  }
}

module.exports = {
  ClientValidationError,
  getClientValidationIssues,
  normalizeClientInput,
  validateClientPayload,
};
