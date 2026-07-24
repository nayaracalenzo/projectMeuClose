"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("sale_budget_payment_drafts");

    if (!table.receiptFinancialAccountId) {
      await queryInterface.addColumn("sale_budget_payment_drafts", "receiptFinancialAccountId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "financial_accounts",
          key: "idFinancialAccount",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    if (!table.entryFinancialAccountId) {
      await queryInterface.addColumn("sale_budget_payment_drafts", "entryFinancialAccountId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "financial_accounts",
          key: "idFinancialAccount",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("sale_budget_payment_drafts");

    if (table.entryFinancialAccountId) {
      await queryInterface.removeColumn("sale_budget_payment_drafts", "entryFinancialAccountId");
    }

    if (table.receiptFinancialAccountId) {
      await queryInterface.removeColumn("sale_budget_payment_drafts", "receiptFinancialAccountId");
    }
  },
};
