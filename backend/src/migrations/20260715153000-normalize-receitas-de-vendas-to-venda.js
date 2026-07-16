"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          UPDATE "bank_entries"
          SET "category" = 'VENDA'
          WHERE UPPER(TRIM(COALESCE("category", ''))) = 'RECEITAS DE VENDAS';
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          UPDATE "cash_entries"
          SET "category" = 'VENDA'
          WHERE UPPER(TRIM(COALESCE("category", ''))) = 'RECEITAS DE VENDAS';
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          UPDATE "bank_entries"
          SET "category" = 'RECEITAS DE VENDAS'
          WHERE UPPER(TRIM(COALESCE("category", ''))) = 'VENDA';
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          UPDATE "cash_entries"
          SET "category" = 'RECEITAS DE VENDAS'
          WHERE UPPER(TRIM(COALESCE("category", ''))) = 'VENDA';
        `,
        { transaction },
      );
    });
  },
};
