module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "cash_entries" AS ce
      SET "financialCategoryId" = fc."idFinancialCategory"
      FROM "financial_categories" AS fc
      WHERE UPPER(TRIM(COALESCE(ce."category", ''))) = UPPER(TRIM(COALESCE(fc."description", '')));
    `);

    await queryInterface.sequelize.query(`
      UPDATE "bank_entries" AS be
      SET "financialCategoryId" = fc."idFinancialCategory"
      FROM "financial_categories" AS fc
      WHERE UPPER(TRIM(COALESCE(be."category", ''))) = UPPER(TRIM(COALESCE(fc."description", '')));
    `);
  },

  async down() {},
};
