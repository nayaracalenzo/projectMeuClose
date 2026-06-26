'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('employees', {
      idEmployee: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      fullName: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      shortName: {
        type: Sequelize.STRING(60),
        allowNull: false,
        unique: true,
      },
      document: {
        type: Sequelize.STRING(14),
        allowNull: true,
        unique: true,
      },
      rg: {
        type: Sequelize.STRING(20),
        allowNull: true,
        unique: true,
      },
      zipCode: {
        type: Sequelize.STRING(8),
        allowNull: true,
      },
      street: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      number: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      complement: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      neighborhood: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(2),
        allowNull: true,
      },
      primaryPhone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      secondaryPhone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      nameSecPhone: {
        type: Sequelize.STRING(60),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(120),
        allowNull: true,
        unique: true,
      },
      comment: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      birthDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      roleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'roles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      bankData: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      dsbl: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('employees');
  },
};
