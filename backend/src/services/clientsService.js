const repository = require("../repositories/clientsRepository.js");

async function getBirthdaysOfMonth() {
  return repository.findBirthdaysOfMonth();
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
    blocked: client.blocked
  }));
}

module.exports = {
  getBirthdaysOfMonth,
  getAllClients,
};