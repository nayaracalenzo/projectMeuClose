const BankEntriesSchema = (sequelize, DataTypes) => {
  const BankEntries = sequelize.define(
    "BankEntries",
    {
      idBankEntry: {
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
      description: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      accountLabel: {
        type: DataTypes.STRING(120),
        allowNull: true,
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
      referenceCode: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
    },
    {
      tableName: "bank_entries",
      timestamps: true,
    },
  );

  BankEntries.associate = (models) => {
    BankEntries.belongsTo(models.Sales, {
      foreignKey: "saleId",
    });
    BankEntries.belongsTo(models.PaymentReceipts, {
      foreignKey: "paymentReceiptId",
    });
    BankEntries.belongsTo(models.PayablePayments, {
      foreignKey: "payablePaymentId",
    });
    BankEntries.belongsTo(models.PaymentTypes, {
      foreignKey: "paymentTypeId",
    });
  };

  return BankEntries;
};

module.exports = BankEntriesSchema;
