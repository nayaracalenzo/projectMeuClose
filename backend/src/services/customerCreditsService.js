const { notFoundError, validationError } = require("../errors/AppError");
const customerCreditsRepository = require("../repositories/customerCreditsRepository");
const clientsRepository = require("../repositories/clientsRepository");

function createCustomerCreditsValidationError(message) {
  return validationError(message, {
    name: "CustomerCreditsValidationError",
  });
}

async function listCustomerCreditsByCustomerId(customerId) {
  const normalizedCustomerId = Number(customerId);

  if (!Number.isInteger(normalizedCustomerId) || normalizedCustomerId <= 0) {
    throw createCustomerCreditsValidationError("Cliente invalido.");
  }

  const customer = await clientsRepository.getClientById(normalizedCustomerId, {
    includeBlocked: true,
  });

  if (!customer) {
    throw notFoundError("Cliente nao encontrado.");
  }

  const credits = await customerCreditsRepository.listActiveCreditsByCustomerId(normalizedCustomerId);
  const totalAvailable = credits.reduce((acc, item) => acc + Number(item.balanceAmount || 0), 0);

  return {
    customer: {
      id: customer.idCustomer,
      name: customer.fullName || customer.companyName || "Cliente",
    },
    totalAvailable: Number(totalAvailable.toFixed(2)),
    items: credits.map((item) => ({
      id: item.idCustomerCredit,
      originalAmount: Number(item.originalAmount || 0),
      balanceAmount: Number(item.balanceAmount || 0),
      description: item.description,
      status: item.status,
      createdAt: item.createdAt,
    })),
  };
}

module.exports = {
  listCustomerCreditsByCustomerId,
};
