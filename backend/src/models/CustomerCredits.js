const CustomerCreditsSchema = (sequelize, DataTypes) => {
  const CustomerCredits = sequelize.define(
    "CustomerCredits",
    {
      idCustomerCredit: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      saleItemId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      originalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      balanceAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "USED", "CANCELLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
    },
    {
      tableName: "customer_credits",
      timestamps: true,
    },
  );

  CustomerCredits.associate = (models) => {
    CustomerCredits.belongsTo(models.Customers, {
      foreignKey: "customerId",
    });
    CustomerCredits.belongsTo(models.Sales, {
      foreignKey: "saleId",
    });
    CustomerCredits.belongsTo(models.SaleItems, {
      foreignKey: "saleItemId",
    });
    CustomerCredits.hasMany(models.CustomerCreditUsages, {
      foreignKey: "customerCreditId",
    });
  };

  return CustomerCredits;
};

module.exports = CustomerCreditsSchema;
