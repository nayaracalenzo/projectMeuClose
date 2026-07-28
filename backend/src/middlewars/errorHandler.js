const { notFoundError, normalizeAppError } = require("../errors/AppError");
const { logger, serializeError } = require("../utils/logger");

function notFoundHandler(req, _res, next) {
  next(notFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(error, req, res, _next) {
  const normalizedError = normalizeAppError(error);
  const serializedOriginalError = serializeError(error);

  logger.error("Unhandled request error", {
    operation: "errorHandler",
    method: req.method,
    originalUrl: req.originalUrl,
    normalizedError: serializeError(normalizedError),
    originalError: serializedOriginalError,
  });

  return res.status(normalizedError.statusCode).json({
    message: normalizedError.message || "Internal server error",
    code: normalizedError.code || error?.code || "APP_ERROR",
    errorName: error?.name || normalizedError.name || "AppError",
    details: serializedOriginalError.errors?.length
      ? serializedOriginalError.errors
      : {
          constraint: serializedOriginalError.constraint || serializedOriginalError.parentConstraint,
          fields: serializedOriginalError.fields,
          parentMessage: serializedOriginalError.parentMessage,
          parentDetail: serializedOriginalError.parentDetail || serializedOriginalError.originalDetail,
        },
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
