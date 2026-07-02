const { validationError } = require("../errors/AppError");
const repository = require("../repositories/cashRepository");

function normalizeDate(value, fieldName, options = {}) {
  if (!value) return null;

  const base = String(value).trim().split("T")[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) {
    throw validationError(`${fieldName} inválida.`);
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    options.endOfDay ? 23 : 0,
    options.endOfDay ? 59 : 0,
    options.endOfDay ? 59 : 0,
    options.endOfDay ? 999 : 0,
  );
}

async function listEntries(query = {}) {
  const scope = query.scope ? String(query.scope).trim() : undefined;
  const search = query.search ? String(query.search).trim() : undefined;

  const entries = await repository.listEntries({
    scope,
    search,
    startDate: normalizeDate(query.startDate, "Data inicial"),
    endDate: normalizeDate(query.endDate, "Data final", { endOfDay: true }),
  });

  return entries.map((item) => ({
    id: item.idCashEntry,
    date: item.occurredAt,
    scope: item.scope,
    description: item.description,
    category: item.category,
    movementType: item.movementType,
    amount: Number(item.amount),
    amountIn: item.movementType === "IN" ? Number(item.amount) : 0,
    amountOut: item.movementType === "OUT" ? Number(item.amount) : 0,
    referenceCode: item.referenceCode,
  }));
}

module.exports = {
  listEntries,
};
