const service = require("../services/clientsService.js");

async function getBirthdaysOfMonthController( _req, res) {
  try {
    const clients = await service.getBirthdaysOfMonth();
    return res.status(200).json(clients);
  } catch (error) {
    return res.status(500).json({
      message: "Erro ao buscar aniversariantes do mês",
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

module.exports = {
  getBirthdaysOfMonthController,
  getAllClients,
};