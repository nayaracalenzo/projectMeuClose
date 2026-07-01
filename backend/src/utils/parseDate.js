function parseDate(dateString) {
  if (!dateString) return null;

  const normalizedValue = String(dateString).trim();
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

  return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = parseDate;
