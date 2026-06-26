const CardTransactionsSchema = (sequelize, DataTypes) => {
  const CardTransactions = sequelize.define(
    "CardTransactions",
    {
      idCardTransaction: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      receivableId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      operatorLabel: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      cardBrand: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      authorizationCode: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      clientInstallmentCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      grossAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      entryAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      netReceivableAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      feeAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      expectedSettlementDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      settlementStatus: {
        type: DataTypes.ENUM("PENDING", "PARTIAL", "SETTLED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
    },
    {
      tableName: "card_transactions",
      timestamps: true,
    }
  );

  CardTransactions.associate = (models) => {
    CardTransactions.belongsTo(models.Sales, {
      foreignKey: "saleId",
    });
    CardTransactions.belongsTo(models.Receivables, {
      foreignKey: "receivableId",
    });
  };

  return CardTransactions;
};

module.exports = CardTransactionsSchema;
