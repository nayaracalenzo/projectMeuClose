"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const [colorsTable, fabricsTable, clothingsTypeTable, sizesTable, financialCategoriesTable] = await Promise.all([
      queryInterface.describeTable("colors"),
      queryInterface.describeTable("fabrics"),
      queryInterface.describeTable("clothings_type"),
      queryInterface.describeTable("sizes"),
      queryInterface.describeTable("financial_categories"),
    ]);

    if (!colorsTable.dsbl) {
      await queryInterface.addColumn("colors", "dsbl", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!fabricsTable.dsbl) {
      await queryInterface.addColumn("fabrics", "dsbl", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!clothingsTypeTable.dsbl) {
      await queryInterface.addColumn("clothings_type", "dsbl", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!sizesTable.dsbl) {
      await queryInterface.addColumn("sizes", "dsbl", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!financialCategoriesTable.dsbl) {
      await queryInterface.addColumn("financial_categories", "dsbl", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const [colorsTable, fabricsTable, clothingsTypeTable, sizesTable, financialCategoriesTable] = await Promise.all([
      queryInterface.describeTable("colors"),
      queryInterface.describeTable("fabrics"),
      queryInterface.describeTable("clothings_type"),
      queryInterface.describeTable("sizes"),
      queryInterface.describeTable("financial_categories"),
    ]);

    if (colorsTable.dsbl) {
      await queryInterface.removeColumn("colors", "dsbl");
    }

    if (fabricsTable.dsbl) {
      await queryInterface.removeColumn("fabrics", "dsbl");
    }

    if (clothingsTypeTable.dsbl) {
      await queryInterface.removeColumn("clothings_type", "dsbl");
    }

    if (sizesTable.dsbl) {
      await queryInterface.removeColumn("sizes", "dsbl");
    }

    if (financialCategoriesTable.dsbl) {
      await queryInterface.removeColumn("financial_categories", "dsbl");
    }
  },
};
