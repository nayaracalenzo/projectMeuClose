'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('customers',   {
    
      idCustomer: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
      typeCustomer: {
      type: Sequelize.ENUM('INDIVIDUAL', 'COMPANY'),
      allowNull: false,
    },
      document: {
      type: Sequelize.STRING(14),
      unique: true,
    },
      rg: {
      type: Sequelize.STRING(20),
      allowNull: true
    },
      fullName: {
      type: Sequelize.STRING(120),
      allowNull: true
    },
      birthDate: {
      type: Sequelize.DATE,
      allowNull: true
    },
      companyName: {
      type: Sequelize.STRING(150),
    },
      tradeName: {
      type: Sequelize.STRING(150),
    },
      phone: {
      type: Sequelize.STRING(20),
      allowNull: false
    },
      email: {
      type: Sequelize.STRING(120),
    },
      zipCode: {
      type: Sequelize.STRING(8)
    },
      street: {
      type: Sequelize.STRING(150)
    },
      number: {
      type: Sequelize.STRING(10)
    },
      complement: {
      type: Sequelize.STRING(100)
    },
      city: {
      type: Sequelize.STRING(100)
    },
      state: {
      type: Sequelize.STRING(2)
    },
      active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
      professionId: {
        type: Sequelize.INTEGER,
      },
      comment: {
        type: Sequelize.STRING(100),
      }
  });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('customers');
  }
};
