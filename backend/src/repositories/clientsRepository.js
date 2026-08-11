const { Op } = require("sequelize");
const {
  CustomerMeasurements,
  CustomerMeasurementValues,
  Customers,
  MeasurementDefinitions,
  Professions,
  Receivables,
  Sales,
  Sequelize,
  sequelize,
} = require("../models");

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

async function listMeasurementDefinitions() {
  return MeasurementDefinitions.findAll({
    where: {
      active: true,
    },
    order: [["sortOrder", "ASC"], ["label", "ASC"]],
  });
}

async function getLatestCustomerMeasurementsRecord(customerId, transaction) {
  if (!customerId) return null;

  return CustomerMeasurements.findOne({
    where: {
      customerId,
    },
    order: [["updatedAt", "DESC"], ["idMeasurement", "DESC"]],
    transaction,
  });
}

async function getLatestSaleByCustomerId(customerId, transaction) {
  if (!customerId) return null;

  return Sales.findOne({
    where: {
      customerId,
    },
    attributes: ["idSale", "createdAt", "updatedAt"],
    order: [["updatedAt", "DESC"], ["idSale", "DESC"]],
    transaction,
  });
}

async function listLatestMeasurementValuesByCustomerId(customerId, transaction) {
  if (!customerId) return [];

  return CustomerMeasurementValues.findAll({
    where: {
      customerId,
    },
    include: [
      {
        model: MeasurementDefinitions,
        attributes: ["idMeasurementDefinition", "key", "label", "sortOrder", "active"],
        required: false,
      },
      {
        model: Sales,
        attributes: ["idSale", "createdAt", "updatedAt"],
        required: false,
      },
    ],
    order: [
      ["updatedAt", "DESC"],
      ["idCustomerMeasurementValue", "DESC"],
    ],
    transaction,
  });
}

async function saveClientMeasurements(
  customerId,
  {
    legacyFields = {},
    dynamicValues = [],
  } = {},
) {
  return sequelize.transaction(async (transaction) => {
    let masterRecord = await getLatestCustomerMeasurementsRecord(customerId, transaction);

    if (masterRecord) {
      await masterRecord.update(legacyFields, { transaction });
    } else {
      masterRecord = await CustomerMeasurements.create(
        {
          customerId,
          saleId: null,
          ...legacyFields,
        },
        { transaction },
      );
    }

    const latestSale = await getLatestSaleByCustomerId(customerId, transaction);

    if (latestSale && Array.isArray(dynamicValues) && dynamicValues.length) {
      const keptDefinitionIds = new Set(
        dynamicValues.map((measurement) => Number(measurement.measurementDefinitionId)),
      );

      await CustomerMeasurementValues.destroy({
        where: {
          customerId,
          saleId: latestSale.idSale,
          measurementDefinitionId: {
            [Op.notIn]: [...keptDefinitionIds],
          },
        },
        transaction,
      });

      for (const measurement of dynamicValues) {
        const existing = await CustomerMeasurementValues.findOne({
          where: {
            customerId,
            saleId: latestSale.idSale,
            measurementDefinitionId: measurement.measurementDefinitionId,
          },
          transaction,
        });

        if (existing) {
          await existing.update(
            {
              value: measurement.value,
            },
            { transaction },
          );
          continue;
        }

        await CustomerMeasurementValues.create(
          {
            customerId,
            saleId: latestSale.idSale,
            measurementDefinitionId: measurement.measurementDefinitionId,
            value: measurement.value,
          },
          { transaction },
        );
      }
    } else if (latestSale) {
      await CustomerMeasurementValues.destroy({
        where: {
          customerId,
          saleId: latestSale.idSale,
        },
        transaction,
      });
    }

    return {
      masterRecord,
      latestSaleId: latestSale?.idSale || null,
    };
  });
}

module.exports = {
  getAllClients,
  findBirthdays,
  getClientById,
  getLatestCustomerMeasurementsRecord,
  getLatestSaleByCustomerId,
  findClientByDocument,
  updateClientById,
  hasOpenReceivablesByCustomerId,
  createClient,
  listLatestMeasurementValuesByCustomerId,
  listMeasurementDefinitions,
  saveClientMeasurements,
};
