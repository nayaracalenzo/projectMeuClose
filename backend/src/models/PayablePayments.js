const PayablePaymentsSchema = (sequelize, DataTypes) => {
  const PayablePayments = sequelize.define(
    "PayablePayments",
    {
      idPayablePayment: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      payableId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      paymentTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
      tableName: "payable_payments",
      timestamps: true,
    }
  );

  PayablePayments.associate = (models) => {
    PayablePayments.belongsTo(models.Payables, {
      foreignKey: "payableId",
    });
    PayablePayments.belongsTo(models.PaymentTypes, {
      foreignKey: "paymentTypeId",
    });
  };

  return PayablePayments;
};

module.exports = PayablePaymentsSchema;
