"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("financial_accounts");

    if (!table.dsbl) {
      await queryInterface.addColumn("financial_accounts", "dsbl", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("financial_accounts");

    if (table.dsbl) {
      await queryInterface.removeColumn("financial_accounts", "dsbl");
    }
  },
};
