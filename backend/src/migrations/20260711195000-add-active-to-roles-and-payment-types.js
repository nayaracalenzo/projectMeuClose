"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const rolesTable = await queryInterface.describeTable("roles");
    if (!rolesTable.active) {
      await queryInterface.addColumn("roles", "active", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    const paymentTypesTable = await queryInterface.describeTable("payment_types");
    if (!paymentTypesTable.active) {
      await queryInterface.addColumn("payment_types", "active", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
  },

  async down(queryInterface) {
    const rolesTable = await queryInterface.describeTable("roles");
    if (rolesTable.active) {
      await queryInterface.removeColumn("roles", "active");
    }

    const paymentTypesTable = await queryInterface.describeTable("payment_types");
    if (paymentTypesTable.active) {
      await queryInterface.removeColumn("payment_types", "active");
    }
  },
};
