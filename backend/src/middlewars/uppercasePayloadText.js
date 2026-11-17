const { uppercasePayloadText } = require("../utils/uppercasePayloadText");

function uppercasePayloadTextMiddleware(req, _res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = uppercasePayloadText(req.body);
  }

  next();
}

module.exports = uppercasePayloadTextMiddleware;
