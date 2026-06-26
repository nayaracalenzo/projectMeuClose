module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("card_transactions", {
      idCardTransaction: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
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
      receivableId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "receivables",
          key: "idReceivable",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      operatorLabel: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      cardBrand: {
        type: Sequelize.STRING(60),
        allowNull: true,
      },
      authorizationCode: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      clientInstallmentCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      grossAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      entryAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      netReceivableAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      feeAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      expectedSettlementDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      settlementStatus: {
        type: Sequelize.ENUM("PENDING", "PARTIAL", "SETTLED"),
        allowNull: false,
        defaultValue: "PENDING",
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
    await queryInterface.dropTable("card_transactions");
  },
};
