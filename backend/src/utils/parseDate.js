const { normalizeLegacyDateTime } = require("./normalizeLegacyDateTime");

function parseDate(dateString) {
  return normalizeLegacyDateTime(dateString);
}

module.exports = parseDate;
