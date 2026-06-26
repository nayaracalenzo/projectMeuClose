module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("payment_receipts", {
      idPaymentReceipt: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      receivableInstallmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "receivable_installments",
          key: "idReceivableInstallment",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      paymentTypeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "payment_types",
          key: "idPaymentType",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      paidAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      referenceCode: {
        type: Sequelize.STRING(100),
        allowNull: true,
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
    await queryInterface.dropTable("payment_receipts");
  },
};
