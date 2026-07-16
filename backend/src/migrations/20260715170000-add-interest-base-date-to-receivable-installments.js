"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("receivable_installments", "interestBaseDate", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE "receivable_installments"
      SET "interestBaseDate" = "dueDate"
      WHERE "interestBaseDate" IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("receivable_installments", "interestBaseDate");
  },
};
