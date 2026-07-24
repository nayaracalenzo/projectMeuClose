const { FinancialAccounts } = require("../models");

async function listActiveOptions(filters = {}) {
  const where = {
    active: true,
    dsbl: false,
  };

  if (filters.scope) {
    where.scope = filters.scope;
  }

  if (filters.targetType) {
    where.targetType = filters.targetType;
  }

  return FinancialAccounts.findAll({
    where,
    order: [
      ["scope", "ASC"],
      ["targetType", "ASC"],
      ["desc", "ASC"],
    ],
  });
}

async function getById(idFinancialAccount) {
  return FinancialAccounts.findOne({
    where: {
      idFinancialAccount,
      dsbl: false,
    },
  });
}

async function findDefaultByScopeAndTarget(scope, targetType) {
  return FinancialAccounts.findOne({
    where: {
      scope,
      targetType,
      active: true,
      dsbl: false,
    },
    order: [["idFinancialAccount", "ASC"]],
  });
}

module.exports = {
  listActiveOptions,
  getById,
  findDefaultByScopeAndTarget,
};
