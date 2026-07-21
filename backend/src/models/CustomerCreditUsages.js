const CustomerCreditUsagesSchema = (sequelize, DataTypes) => {
  const CustomerCreditUsages = sequelize.define(
    "CustomerCreditUsages",
    {
      idCustomerCreditUsage: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      customerCreditId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      paymentReceiptId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
    },
    {
      tableName: "customer_credit_usages",
      timestamps: true,
    },
  );

  CustomerCreditUsages.associate = (models) => {
    CustomerCreditUsages.belongsTo(models.CustomerCredits, {
      foreignKey: "customerCreditId",
    });
    CustomerCreditUsages.belongsTo(models.Sales, {
      foreignKey: "saleId",
    });
    CustomerCreditUsages.belongsTo(models.PaymentReceipts, {
      foreignKey: "paymentReceiptId",
    });
  };

  return CustomerCreditUsages;
};

module.exports = CustomerCreditUsagesSchema;
