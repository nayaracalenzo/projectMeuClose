module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("receivable_installments", {
      idReceivableInstallment: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      receivableId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "receivables",
          key: "idReceivable",
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
      installmentNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      totalInstallments: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      dueDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      paidAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM("OPEN", "PARTIAL", "PAID", "OVERDUE"),
        allowNull: false,
        defaultValue: "OPEN",
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
    await queryInterface.dropTable("receivable_installments");
  },
};
