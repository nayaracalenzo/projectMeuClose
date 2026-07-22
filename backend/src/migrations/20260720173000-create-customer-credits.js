"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("customer_credits", {
      idCustomerCredit: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      customerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "customers",
          key: "idCustomer",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      saleId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      saleItemId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "sale_items",
          key: "idSaleItem",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      originalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      balanceAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("ACTIVE", "USED", "CANCELLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable("customer_credits");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_customer_credits_status";');
  },
};
