module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("payables", {
      idPayable: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      scope: {
        type: Sequelize.ENUM("LOJA", "PESSOAL"),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      beneficiary: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      openAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      dueDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("OPEN", "PARTIAL", "PAID", "OVERDUE"),
        allowNull: false,
        defaultValue: "OPEN",
      },
      settlementTarget: {
        type: Sequelize.ENUM("BANCO", "CAIXA"),
        allowNull: false,
      },
      accountLabel: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      plannedPaymentTypeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "payment_types",
          key: "idPaymentType",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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
    await queryInterface.dropTable("payables");
  },
};
