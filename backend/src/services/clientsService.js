const repository = require("../repositories/clientsRepository.js");
const employeesRepository = require("../repositories/employeesRepository.js");
const { normalizeDateToLocalMidnight } = require("../utils/normalizeDate.js");
const {
  normalizeClientInput,
  validateClientPayload,
} = require("../utils/clientValidation.js");
const {
  parseBirthdayFilters,
  sortBirthdays,
} = require("./birthdayService.js");

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

async function getAllClients() {
  const clients = await repository.getAllClients();

  return clients.map((client) => ({
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
  }));
}

async function getClientById(id) {
  const client = await repository.getClientById(id);
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
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
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
    phone: normalizedBody.phone,
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
  const payload = buildClientPayload(body, { isCreate: false });
  const updated = await repository.updateClientById(id, payload);
  if (!updated) return null;

  return getClientById(id);
}

async function createClient(body) {
  const payload = buildClientPayload(body, { isCreate: true });
  const created = await repository.createClient(payload);
  return getClientById(created.idCustomer);
}

module.exports = {
  getBirthdaysOfMonth,
  getAllClients,
  getClientById,
  updateClientById,
  createClient,
};
