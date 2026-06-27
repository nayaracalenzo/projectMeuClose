const service = require("../services/authService");

async function register(req, res, next) {
  try {
    const user = await service.register(req.body);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await service.login(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
};
