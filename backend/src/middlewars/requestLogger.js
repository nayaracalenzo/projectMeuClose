const { logger } = require("../utils/logger");

function requestLogger(req, res, next) {
  const startedAt = Date.now();

  logger.info("HTTP request started", {
    method: req.method,
    path: req.originalUrl,
    origin: req.headers.origin || "unknown",
  });

  res.on("finish", () => {
    logger.info("HTTP request finished", {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}

module.exports = requestLogger;
