function createAppError(message, statusCode = 500, options = {}) {
  const error = new Error(message || "Internal server error");

  error.name = options.name || "AppError";
  error.statusCode = statusCode;
  error.code = options.code || "APP_ERROR";
  error.isAppError = true;

  return error;
}

function validationError(message = "Validation failed", options = {}) {
  return createAppError(message, options.statusCode || 400, {
    name: options.name || "ValidationError",
    code: options.code || "VALIDATION_ERROR",
  });
}

function unauthorizedError(message = "Unauthorized", options = {}) {
  return createAppError(message, options.statusCode || 401, {
    name: options.name || "UnauthorizedError",
    code: options.code || "UNAUTHORIZED",
  });
}

function forbiddenError(message = "Forbidden", options = {}) {
  return createAppError(message, options.statusCode || 403, {
    name: options.name || "ForbiddenError",
    code: options.code || "FORBIDDEN",
  });
}

function notFoundError(message = "Resource not found", options = {}) {
  return createAppError(message, options.statusCode || 404, {
    name: options.name || "NotFoundError",
    code: options.code || "NOT_FOUND",
  });
}

function conflictError(message = "Conflict", options = {}) {
  return createAppError(message, options.statusCode || 409, {
    name: options.name || "ConflictError",
    code: options.code || "CONFLICT",
  });
}

function isAppError(error) {
  return Boolean(error && error.isAppError && typeof error.statusCode === "number");
}

function normalizeAppError(error) {
  if (isAppError(error)) {
    return error;
  }

  return createAppError(error?.message || "Internal server error", error?.statusCode || 500);
}

module.exports = {
  createAppError,
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError,
  isAppError,
  normalizeAppError,
};
