"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("financial_accounts", {
      idFinancialAccount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      desc: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      scope: {
        type: Sequelize.ENUM("LOJA", "PESSOAL"),
        allowNull: false,
      },
      targetType: {
        type: Sequelize.ENUM("CASH", "BANK"),
        allowNull: false,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    const now = new Date();

    await queryInterface.bulkInsert("financial_accounts", [
      {
        desc: "Caixa da Loja",
        scope: "LOJA",
        targetType: "CASH",
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        desc: "Banco da Loja",
        scope: "LOJA",
        targetType: "BANK",
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("financial_accounts");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_financial_accounts_scope";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_financial_accounts_targetType";');
  },
};
