module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "bank_entries"
      SET "financialCategoryId" = 1
      WHERE
        COALESCE("financialCategoryId", 3) = 3
        AND "movementType" = 'IN'
        AND (
          "sourceType" IN ('SALE_RECEIPT', 'RECEIVABLE_RECEIPT')
          OR UPPER(TRIM(COALESCE("category", ''))) IN ('VENDA', 'RECEBIMENTO', 'RECEITAS DE VENDAS')
          OR UPPER(TRIM(COALESCE("description", ''))) LIKE 'REC.%'
          OR UPPER(TRIM(COALESCE("description", ''))) LIKE 'RECEBIMENTO%'
          OR UPPER(TRIM(COALESCE("description", ''))) LIKE 'ENTRADA DA VENDA%'
        );
    `);
  },

  async down() {},
};
