"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("sale_budget_payment_drafts", {
      idSaleBudgetPaymentDraft: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      saleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      paymentTypeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "payment_types",
          key: "idPaymentType",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      installmentCount: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      installmentIntervalDays: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      dueDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      entryAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      entryPaymentTypeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "payment_types",
          key: "idPaymentType",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      entryReferenceCode: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      paymentReferenceCode: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      useCustomerCredit: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      customerCreditAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
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
    await queryInterface.dropTable("sale_budget_payment_drafts");
  },
};
