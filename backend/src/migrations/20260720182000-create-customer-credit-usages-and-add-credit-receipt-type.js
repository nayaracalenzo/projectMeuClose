"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("customer_credit_usages", {
      idCustomerCreditUsage: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      customerCreditId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "customer_credits",
          key: "idCustomerCredit",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      saleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      paymentReceiptId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "payment_receipts",
          key: "idPaymentReceipt",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_payment_receipts_receiptType" ADD VALUE IF NOT EXISTS 'CUSTOMER_CREDIT';`,
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("customer_credit_usages");
  },
};
