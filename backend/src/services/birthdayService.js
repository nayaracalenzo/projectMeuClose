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
  sortBirthdays,
};
