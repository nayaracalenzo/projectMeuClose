'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('users', 'email', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.ENUM('ADMIN', 'EMPLOYEE'),
      allowNull: false,
      defaultValue: 'EMPLOYEE',
    });

    await queryInterface.addColumn('users', 'createdAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });

    await queryInterface.addColumn('users', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });

  },

  async down(queryInterface, Sequelize) {


  }
};