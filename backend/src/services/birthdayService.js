const { validationError } = require("../errors/AppError");

function parseBirthdayFilters(query = {}) {
  const now = new Date();
  const parsedMonth =
    query.month == null || query.month === ""
      ? now.getMonth() + 1
      : Number(query.month);
  const parsedYear =
    query.year == null || query.year === "" ? null : Number(query.year);

  if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    throw validationError("Mes invalido. Informe um valor entre 1 e 12.");
  }

  if (
    parsedYear != null &&
    (!Number.isInteger(parsedYear) || parsedYear < 1 || parsedYear > 9999)
  ) {
    throw validationError("Ano invalido. Informe um ano valido.");
  }

  return {
    month: parsedMonth,
    year: parsedYear,
  };
}

function getCurrentWeekBirthdayWindow(referenceDate = new Date()) {
  const current = new Date(referenceDate);
  current.setHours(0, 0, 0, 0);

  const dayOfWeek = current.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const startDate = new Date(current);
  startDate.setDate(current.getDate() - daysSinceMonday);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate,
    endDate,
  };
}

function extractMonthDayParts(birthDate) {
  if (!birthDate) return null;

  if (birthDate instanceof Date) {
    const timestamp = birthDate.getTime();
    if (Number.isNaN(timestamp)) return null;

    return {
      month: birthDate.getMonth() + 1,
      day: birthDate.getDate(),
    };
  }

  const base = String(birthDate).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) return null;

  return {
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getBirthdayOccurrenceTimestamp(birthDate, referenceYear) {
  const parts = extractMonthDayParts(birthDate);
  if (!parts) return Number.POSITIVE_INFINITY;

  return new Date(referenceYear, parts.month - 1, parts.day, 0, 0, 0, 0).getTime();
}

function isBirthdayInWindow(birthDate, startDate, endDate) {
  if (!birthDate) return false;

  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const yearsToCheck =
    startYear === endYear ? [startYear] : [startYear, endYear];

  return yearsToCheck.some((year) => {
    const timestamp = getBirthdayOccurrenceTimestamp(birthDate, year);
    return timestamp >= startDate.getTime() && timestamp <= endDate.getTime();
  });
}

function sortBirthdays(left, right) {
  const leftDate = left.birthDate ? new Date(left.birthDate).getTime() : 0;
  const rightDate = right.birthDate ? new Date(right.birthDate).getTime() : 0;

  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  return left.fullName.localeCompare(right.fullName, "pt-BR");
}

module.exports = {
  parseBirthdayFilters,
  getCurrentWeekBirthdayWindow,
  getBirthdayOccurrenceTimestamp,
  isBirthdayInWindow,
  sortBirthdays,
};
