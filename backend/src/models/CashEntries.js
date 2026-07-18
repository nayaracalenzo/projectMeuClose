const CashEntriesSchema = (sequelize, DataTypes) => {
  const CashEntries = sequelize.define(
    "CashEntries",
    {
      idCashEntry: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      scope: {
        type: DataTypes.ENUM("LOJA", "PESSOAL"),
        allowNull: false,
        defaultValue: "LOJA",
      },
      movementType: {
        type: DataTypes.ENUM("IN", "OUT"),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      financialCategoryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      occurredAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      sourceType: {
        type: DataTypes.ENUM("SALE_RECEIPT", "RECEIVABLE_RECEIPT", "PAYABLE_PAYMENT", "MANUAL"),
        allowNull: false,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      paymentReceiptId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      payablePaymentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      paymentTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      cashSessionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      referenceCode: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      transferKey: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      reversalOfCashEntryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "cash_entries",
      timestamps: true,
    },
  );

  CashEntries.associate = (models) => {
    CashEntries.belongsTo(models.Sales, {
      foreignKey: "saleId",
    });
    CashEntries.belongsTo(models.PaymentReceipts, {
      foreignKey: "paymentReceiptId",
    });
    CashEntries.belongsTo(models.PayablePayments, {
      foreignKey: "payablePaymentId",
    });
    CashEntries.belongsTo(models.PaymentTypes, {
      foreignKey: "paymentTypeId",
    });
    CashEntries.belongsTo(models.CashSessions, {
      foreignKey: "cashSessionId",
    });
    CashEntries.belongsTo(models.FinancialCategories, {
      foreignKey: "financialCategoryId",
    });
    CashEntries.belongsTo(models.CashEntries, {
      foreignKey: "reversalOfCashEntryId",
      as: "ReversedCashEntry",
    });
  };

  return CashEntries;
};

module.exports = CashEntriesSchema;
