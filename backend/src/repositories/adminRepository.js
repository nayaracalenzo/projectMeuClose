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

async function listResource(resource) {
  const resourceData = getModelAndConfig(resource);
  if (!resourceData) return null;

  const { model, config } = resourceData;
  const query = {
    order: config.defaultOrder,
  };

  if (resource === "employees") {
    query.where = { dsbl: false };
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
