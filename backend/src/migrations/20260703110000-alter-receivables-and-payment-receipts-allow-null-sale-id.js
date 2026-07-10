module.exports = {
  async up(queryInterface, Sequelize) {
    const receivablesTable = await queryInterface.describeTable("receivables");
    const paymentReceiptsTable = await queryInterface.describeTable("payment_receipts");

    if (receivablesTable.saleId && receivablesTable.saleId.allowNull === false) {
      await queryInterface.changeColumn("receivables", "saleId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    if (paymentReceiptsTable.saleId && paymentReceiptsTable.saleId.allowNull === false) {
      await queryInterface.changeColumn("payment_receipts", "saleId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const receivablesTable = await queryInterface.describeTable("receivables");
    const paymentReceiptsTable = await queryInterface.describeTable("payment_receipts");

    if (receivablesTable.saleId && receivablesTable.saleId.allowNull === true) {
      await queryInterface.changeColumn("receivables", "saleId", {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    }

    if (paymentReceiptsTable.saleId && paymentReceiptsTable.saleId.allowNull === true) {
      await queryInterface.changeColumn("payment_receipts", "saleId", {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    }
  },
};
