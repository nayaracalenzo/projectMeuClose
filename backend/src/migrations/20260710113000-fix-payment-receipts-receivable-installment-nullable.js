module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("payment_receipts");

    if (!table.receivableInstallmentId) {
      return;
    }

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
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("payment_receipts");

    if (!table.receivableInstallmentId) {
      return;
    }

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
  },
};
