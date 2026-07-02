const PaymentTypesSchema = (sequelize, DataTypes) => {
  const PaymentTypes = sequelize.define(
    "PaymentTypes",
    {
      idPaymentType: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      desc: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
    },
    {
      tableName: "payment_types",
      timestamps: false,
    }
  );

  PaymentTypes.associate = (models) => {
    PaymentTypes.hasMany(models.Sales, {
      foreignKey: "paymentTypeId",
    });
    PaymentTypes.hasMany(models.ReceivableInstallments, {
      foreignKey: "paymentTypeId",
    });
    PaymentTypes.hasMany(models.PaymentReceipts, {
      foreignKey: "paymentTypeId",
    });
    PaymentTypes.hasMany(models.Payables, {
      foreignKey: "plannedPaymentTypeId",
    });
    PaymentTypes.hasMany(models.PayablePayments, {
      foreignKey: "paymentTypeId",
    });
  };

  return PaymentTypes;
};

module.exports = PaymentTypesSchema;
