"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("sales");

    if (!table.doesNotGenerateDebt) {
      await queryInterface.addColumn("sales", "doesNotGenerateDebt", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!table.internalReason) {
      await queryInterface.addColumn("sales", "internalReason", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("sales");

    if (table.internalReason) {
      await queryInterface.removeColumn("sales", "internalReason");
    }

    if (table.doesNotGenerateDebt) {
      await queryInterface.removeColumn("sales", "doesNotGenerateDebt");
    }
  },
};
