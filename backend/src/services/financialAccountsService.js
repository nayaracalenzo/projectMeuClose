const repository = require("../repositories/financialAccountsRepository");

function normalizeScope(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "PESSOAL" ? "PESSOAL" : normalized === "LOJA" ? "LOJA" : null;
}

function normalizeTargetType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "CASH" ? "CASH" : normalized === "BANK" ? "BANK" : null;
}

async function listOptions(query = {}) {
  const scope = query.scope ? normalizeScope(query.scope) : null;
  const targetType = query.targetType ? normalizeTargetType(query.targetType) : null;

  const items = await repository.listActiveOptions({
    scope: scope || undefined,
    targetType: targetType || undefined,
  });

  return items.map((item) => ({
    id: Number(item.idFinancialAccount),
    label: item.desc,
    value: String(item.idFinancialAccount),
    scope: item.scope,
    targetType: item.targetType,
  }));
}

module.exports = {
  listOptions,
};
