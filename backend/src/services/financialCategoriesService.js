const repository = require("../repositories/financialCategoriesRepository");

async function listFinancialCategories() {
  const items = await repository.listCategories();

  return items.map((item) => ({
    id: item.idFinancialCategory,
    description: item.description,
  }));
}

module.exports = {
  listFinancialCategories,
};
