const service = require("../services/clientsService.js");

async function getBirthdaysOfMonthController(req, res) {
  try {
    const clients = await service.getBirthdaysOfMonth(req.query);
    return res.status(200).json(clients);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({
      message: "Erro ao buscar aniversariantes do mes",
      error,
    });
  }
}

async function getAllClients(_req, res) {
  try {
    const clients = await service.getAllClients();
    return res.status(200).json(clients);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function getClientById(req, res) {
  try {
    const { id } = req.params;
    const client = await service.getClientById(id);

    if (!client) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    return res.status(200).json(client);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function updateClientById(req, res) {
  try {
    const { id } = req.params;
    const client = await service.updateClientById(id, req.body);

    if (!client) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    return res.status(200).json(client);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }

    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function createClient(req, res) {
  try {
    const created = await service.createClient(req.body);
    return res.status(201).json(created);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }

    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getBirthdaysOfMonthController,
  getAllClients,
  getClientById,
  updateClientById,
  createClient,
};
