const PaymentReceiptsSchema = (sequelize, DataTypes) => {
  const PaymentReceipts = sequelize.define(
    "PaymentReceipts",
    {
      idPaymentReceipt: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      receivableInstallmentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      paymentTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      receiptType: {
        type: DataTypes.ENUM("ENTRY", "SALE_FULL", "INSTALLMENT"),
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      referenceCode: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
    },
    {
      tableName: "payment_receipts",
      timestamps: true,
    }
  );

  PaymentReceipts.associate = (models) => {
    PaymentReceipts.belongsTo(models.Sales, {
      foreignKey: "saleId",
    });
    PaymentReceipts.belongsTo(models.ReceivableInstallments, {
      foreignKey: "receivableInstallmentId",
    });
    PaymentReceipts.belongsTo(models.PaymentTypes, {
      foreignKey: "paymentTypeId",
    });
  };

  return PaymentReceipts;
};

module.exports = PaymentReceiptsSchema;
