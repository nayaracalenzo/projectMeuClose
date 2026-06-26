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
      kind: {
        type: DataTypes.ENUM("CASH", "CHECK", "BOOKLET", "INVOICE", "CARD"),
        allowNull: true,
      },
      requiresDueDate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      allowsEntryAmount: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      allowedEntryPaymentKinds: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      allowsInstallments: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      maxInstallments: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      defaultInstallments: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      financialFlow: {
        type: DataTypes.ENUM("IMMEDIATE_CASH", "FUTURE_CUSTOMER", "FUTURE_OPERATOR"),
        allowNull: false,
        defaultValue: "IMMEDIATE_CASH",
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "payment_types",
      timestamps: true,
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
