const { notFoundError, normalizeAppError } = require("../errors/AppError");
const { logger, serializeError } = require("../utils/logger");

function notFoundHandler(req, _res, next) {
  next(notFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(error, req, res, _next) {
  const normalizedError = normalizeAppError(error);

  if (normalizedError.statusCode >= 500) {
    logger.error("Unhandled request error", {
      operation: "errorHandler",
      method: req.method,
      originalUrl: req.originalUrl,
      ...serializeError(normalizedError),
    });
  }

  return res.status(normalizedError.statusCode).json({
    message: normalizedError.message || "Internal server error",
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
