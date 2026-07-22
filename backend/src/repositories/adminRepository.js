const { Op } = require("sequelize");
const { getAdminResourceConfig } = require("../utils/adminResourceConfig");
const db = require("../models");

function getModelAndConfig(resource) {
  const config = getAdminResourceConfig(resource);

  if (!config) {
    return null;
  }

  return {
    config,
    model: db[config.modelName],
  };
}

async function listResource(resource, filters = {}) {
  const resourceData = getModelAndConfig(resource);
  if (!resourceData) return null;

  const { model, config } = resourceData;
  const query = {
    order: config.defaultOrder,
  };

  if (resource === "employees") {
    query.where = { dsbl: false };
  }

  if (resource === "audits") {
    const where = {};

    if (filters.auditTypeId) {
      where.auditTypeId = Number(filters.auditTypeId);
    }

    if (filters.history) {
      where.history = {
        [Op.iLike]: `%${String(filters.history).trim()}%`,
      };
    }

    if (filters.startDate || filters.endDate) {
      where.occurredAt = {};

      if (filters.startDate) {
        where.occurredAt[Op.gte] = new Date(filters.startDate);
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.occurredAt[Op.lte] = endDate;
      }
    }

    query.where = where;
    query.include = [
      {
        model: db.AuditTypes,
        attributes: ["idAuditType", "description"],
      },
      {
        model: db.Users,
        attributes: ["idUser", "name", "username"],
        required: false,
      },
    ];

    const records = await model.findAll(query);
    return records.map((record) => {
      const data = record.get({ plain: true });

      return {
        idAudit: data.idAudit,
        occurredAt: data.occurredAt,
        auditTypeId: data.auditTypeId,
        auditTypeDescription: data.AuditType?.description || "-",
        userId: data.userId,
        userName: data.User?.name || data.User?.username || "-",
        history: data.history,
        reason: data.reason,
      };
    });
  }

  return model.findAll(query);
}

async function createResource(resource, payload) {
  const resourceData = getModelAndConfig(resource);
  if (!resourceData) return null;

  const { model } = resourceData;
  return model.create(payload);
}

async function findSupplierByDocument(document, { excludeId } = {}) {
  if (!document) return null;

  const where = {
    document,
  };

  if (excludeId) {
    where.idSupplier = {
      [Op.ne]: excludeId,
    };
  }

  return db.Suppliers.findOne({
    where,
    order: [["idSupplier", "ASC"]],
  });
}

async function findEmployeeByDocument(document, { excludeId } = {}) {
  if (!document) return null;

  const where = {
    document,
    dsbl: false,
  };

  if (excludeId) {
    where.idEmployee = {
      [Op.ne]: excludeId,
    };
  }

  return db.Employees.findOne({
    where,
    order: [["idEmployee", "ASC"]],
  });
}

async function updateResource(resource, id, payload) {
  const resourceData = getModelAndConfig(resource);
  if (!resourceData) return null;

  const { model, config } = resourceData;
  const record = await model.findByPk(id);
  if (!record) return undefined;

  await record.update(payload);
  return model.findByPk(record[config.primaryKey]);
}

async function deleteResource(resource, id) {
  const resourceData = getModelAndConfig(resource);
  if (!resourceData) return null;

  const { model, config } = resourceData;
  const record = await model.findByPk(id);
  if (!record) return undefined;

  if (config.softDelete) {
    const payload = {};

    if ("dsbl" in record.dataValues) {
      payload.dsbl = true;
    }

    if ("active" in record.dataValues) {
      payload.active = false;
    }

    if (resource === "suppliers" && "blocked" in record.dataValues) {
      payload.blocked = true;
    }

    await record.update(payload);
    return true;
  }

  await db.sequelize.transaction(async (transaction) => {
    switch (resource) {
      case "professions":
        await db.Customers.update(
          { professionId: null },
          { where: { professionId: id }, transaction },
        );
        break;
      case "roles":
        await db.Employees.update(
          { roleId: null },
          { where: { roleId: id }, transaction },
        );
        await db.Users.update(
          { roleId: null },
          { where: { roleId: id }, transaction },
        );
        break;
      case "colors":
        await db.Products.update(
          { colorId: null },
          { where: { colorId: id }, transaction },
        );
        break;
      case "sizes":
        await db.Products.update(
          { sizeId: null },
          { where: { sizeId: id }, transaction },
        );
        break;
      case "clothings-types":
        await db.Products.update(
          { clothingTypeId: null },
          { where: { clothingTypeId: id }, transaction },
        );
        break;
      case "fabrics":
        await db.Products.update(
          { fabricId: null },
          { where: { fabricId: id }, transaction },
        );
        break;
      case "payment-types":
        await Promise.all([
          db.Sales.update(
            { paymentTypeId: null },
            { where: { paymentTypeId: id }, transaction },
          ),
          db.ReceivableInstallments.update(
            { paymentTypeId: null },
            { where: { paymentTypeId: id }, transaction },
          ),
          db.PaymentReceipts.update(
            { paymentTypeId: null },
            { where: { paymentTypeId: id }, transaction },
          ),
          db.Payables.update(
            { plannedPaymentTypeId: null },
            { where: { plannedPaymentTypeId: id }, transaction },
          ),
          db.PayablePayments.update(
            { paymentTypeId: null },
            { where: { paymentTypeId: id }, transaction },
          ),
          db.CashEntries.update(
            { paymentTypeId: null },
            { where: { paymentTypeId: id }, transaction },
          ),
          db.BankEntries.update(
            { paymentTypeId: null },
            { where: { paymentTypeId: id }, transaction },
          ),
        ]);
        break;
      default:
        break;
    }

    await record.destroy({ transaction });
  });

  return true;
}

module.exports = {
  getModelAndConfig,
  listResource,
  createResource,
  findSupplierByDocument,
  findEmployeeByDocument,
  updateResource,
  deleteResource,
};
