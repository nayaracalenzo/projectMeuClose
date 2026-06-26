module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("payment_receipts");

    if (!table.saleId) {
      await queryInterface.addColumn("payment_receipts", "saleId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    }

    if (table.receivableInstallmentId && table.receivableInstallmentId.allowNull === false) {
      await queryInterface.changeColumn("payment_receipts", "receivableInstallmentId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "receivable_installments",
          key: "idReceivableInstallment",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("payment_receipts");

    if (table.receivableInstallmentId && table.receivableInstallmentId.allowNull === true) {
      await queryInterface.changeColumn("payment_receipts", "receivableInstallmentId", {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "receivable_installments",
          key: "idReceivableInstallment",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    }

    if (table.saleId) {
      await queryInterface.removeColumn("payment_receipts", "saleId");
    }
  },
};
