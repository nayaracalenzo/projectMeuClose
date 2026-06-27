const jwt = require("jsonwebtoken");
const { unauthorizedError } = require("../errors/AppError");

function authMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(unauthorizedError("Authorization header not provided"));
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(unauthorizedError("Invalid authorization format"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return next(unauthorizedError("Invalid or expired token"));
  }
}

module.exports = authMiddleware;
