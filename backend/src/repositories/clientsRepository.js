const { Op } = require("sequelize");
const { Customers, Professions, Receivables, Sequelize } = require("../models");

function buildBirthdayWhere({ month, year }) {
  const filters = [`EXTRACT(MONTH FROM "birthDate") = ${month}`];

  if (year) {
    filters.push(`EXTRACT(YEAR FROM "birthDate") = ${year}`);
  }

  return Sequelize.literal(filters.join(" AND "));
}

function buildClientsWhere({ search, status } = {}) {
  const where = {
    blocked: false,
  };

  if (search) {
    where[Op.or] = [
      {
        fullName: {
          [Op.iLike]: `%${search}%`,
        },
      },
      {
        document: {
          [Op.iLike]: `%${search}%`,
        },
      },
      {
        companyName: {
          [Op.iLike]: `%${search}%`,
        },
      },
    ];
  }

  if (status === "ativo") {
    where.active = true;
  } else if (status === "inativo") {
    where.active = false;
  }

  return where;
}

async function getAllClients({ search, status, page, pageSize } = {}) {
  return Customers.findAndCountAll({
    where: buildClientsWhere({ search, status }),
    order: [["fullName", "ASC"]],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
}

async function findBirthdays({ month, year }) {
  return Customers.findAll({
    where: {
      [Op.and]: [buildBirthdayWhere({ month, year }), { blocked: false }],
    },
    order: [["birthDate", "ASC"], ["fullName", "ASC"]],
  });
}

async function getClientById(id, { includeBlocked = false } = {}) {
  const where = {
    idCustomer: id,
  };

  if (!includeBlocked) {
    where.blocked = false;
  }

  return Customers.findOne({
    where,
    include: [
      {
        model: Professions,
        attributes: ["idProfession", "nameProfession"],
        required: false,
      },
    ],
  });
}

async function findClientByDocument(document, { excludeId } = {}) {
  if (!document) return null;

  const where = {
    document,
  };

  if (excludeId) {
    where.idCustomer = {
      [Op.ne]: excludeId,
    };
  }

  return Customers.findOne({
    where,
    include: [
      {
        model: Professions,
        attributes: ["idProfession", "nameProfession"],
        required: false,
      },
    ],
    order: [["idCustomer", "ASC"]],
  });
}

async function updateClientById(id, payload) {
  const client = await Customers.findByPk(id);
  if (!client) return null;

  await client.update(payload);
  return client;
}

async function hasOpenReceivablesByCustomerId(customerId) {
  if (!customerId) return false;

  const count = await Receivables.count({
    where: {
      customerId,
      status: {
        [Op.in]: ["OPEN", "PARTIAL", "OVERDUE"],
      },
      openAmount: {
        [Op.gt]: 0,
      },
    },
  });

  return count > 0;
}

async function createClient(payload) {
  return Customers.create(payload);
}

module.exports = {
  getAllClients,
  findBirthdays,
  getClientById,
  findClientByDocument,
  updateClientById,
  hasOpenReceivablesByCustomerId,
  createClient,
};
