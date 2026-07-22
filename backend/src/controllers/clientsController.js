const { notFoundError } = require("../errors/AppError");
const service = require("../services/clientsService.js");
const customerCreditsService = require("../services/customerCreditsService");

async function getBirthdaysOfMonthController(req, res, next) {
  try {
    const clients = await service.getBirthdaysOfMonth(req.query);
    return res.status(200).json(clients);
  } catch (error) {
    return next(error);
  }
}

async function getAllClients(req, res, next) {
  try {
    const clients = await service.getAllClients(req.query);
    return res.status(200).json(clients);
  } catch (error) {
    return next(error);
  }
}

async function getClientById(req, res, next) {
  try {
    const { id } = req.params;
    const client = await service.getClientById(id);

    if (!client) {
      throw notFoundError("Cliente não encontrado");
    }

    return res.status(200).json(client);
  } catch (error) {
    return next(error);
  }
}

async function updateClientById(req, res, next) {
  try {
    const { id } = req.params;
    const client = await service.updateClientById(id, req.body);

    if (!client) {
      throw notFoundError("Cliente não encontrado");
    }

    return res.status(200).json(client);
  } catch (error) {
    return next(error);
  }
}

async function createClient(req, res, next) {
  try {
    const created = await service.createClient(req.body);
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
}

async function getClientCreditsController(req, res, next) {
  try {
    const data = await customerCreditsService.listCustomerCreditsByCustomerId(req.params.id);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getBirthdaysOfMonthController,
  getAllClients,
  getClientById,
  getClientCreditsController,
  updateClientById,
  createClient,
};
