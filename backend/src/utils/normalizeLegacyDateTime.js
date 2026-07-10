function normalizeLegacyDateTime(value, options = {}) {
  if (value === undefined || value === null) return null;

  const normalizedValue = String(value).trim();
  if (!normalizedValue) return null;

  const [datePart, timePart = "00:00:00"] = normalizedValue.split(" ");
  const [day, month, year] = datePart.split("/").map(Number);
  const [hours = 0, minutes = 0, seconds = 0] = timePart.split(":").map(Number);

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  if (Number.isNaN(date.getTime())) return null;

  if (options.dateOnly) {
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  return date;
}

module.exports = {
  normalizeLegacyDateTime,
};
