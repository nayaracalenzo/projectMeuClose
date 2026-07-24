const { FinancialCategories } = require("../models");

async function listCategories() {
  return FinancialCategories.findAll({
    where: {
      dsbl: false,
    },
    order: [["description", "ASC"]],
  });
}

async function getCategoryById(idFinancialCategory) {
  return FinancialCategories.findOne({
    where: {
      idFinancialCategory,
      dsbl: false,
    },
  });
}

async function getCategoryByDescription(description) {
  const normalized = String(description || "").trim();

  if (!normalized) {
    return null;
  }

  const categories = await FinancialCategories.findAll({
    where: {
      dsbl: false,
    },
  });

  return (
    categories.find(
      (item) =>
        String(item.description || "").trim().toUpperCase() === normalized.toUpperCase(),
    ) || null
  );
}

module.exports = {
  listCategories,
  getCategoryById,
  getCategoryByDescription,
};
