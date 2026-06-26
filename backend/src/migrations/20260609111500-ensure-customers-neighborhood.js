'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('customers');

    if (!table.neighborhood) {
      await queryInterface.addColumn('customers', 'neighborhood', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('customers');

    if (table.neighborhood) {
      await queryInterface.removeColumn('customers', 'neighborhood');
    }
  },
};
