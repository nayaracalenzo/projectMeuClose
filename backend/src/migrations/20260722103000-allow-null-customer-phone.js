"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("customers", "phone", {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE "customers"
      SET "phone" = ''
      WHERE "phone" IS NULL;
    `);

    await queryInterface.changeColumn("customers", "phone", {
      type: Sequelize.STRING(20),
      allowNull: false,
    });
  },
};
