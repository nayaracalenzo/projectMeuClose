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

    await record.update(payload);
    return true;
  }

  await record.destroy();
  return true;
}

module.exports = {
  getModelAndConfig,
  listResource,
  createResource,
  updateResource,
  deleteResource,
};
