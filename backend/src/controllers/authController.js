const service = require("../services/authService");

async function register(req, res) {
  try {
    const user = await service.register(req.body);
    return res.status(201).json(user);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function login(req, res) {
  try {
    const result = await service.login(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(401).json({ message: error.message });
  }
}

module.exports = {
  register,
  login,
};