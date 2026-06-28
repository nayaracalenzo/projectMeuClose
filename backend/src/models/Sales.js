const SalesSchema = (sequelize, DataTypes) => {
  const Sales = sequelize.define(
    "Sales",
    {
      idSale: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      discountType: {
        type: DataTypes.ENUM("PERCENTAGE", "FIXED"),
        allowNull: true,
      },
      discountValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      finalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("OPEN", "COMPLETED", "CANCELLED"),
        defaultValue: "OPEN",
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      paymentTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      installmentCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      tableName: "sales",
      timestamps: true,
    }
  );
  Sales.associate = (models) => {
    Sales.belongsTo(models.Customers, {
      foreignKey: "customerId",
    });
    Sales.belongsTo(models.Users, {
      foreignKey: "userId",
    });
    Sales.belongsTo(models.PaymentTypes, {
      foreignKey: "paymentTypeId",
    });
    Sales.hasMany(models.SaleItems, {
      foreignKey: "saleId",
    });
    Sales.hasMany(models.Products, {
      foreignKey: "saleId",
    });
    Sales.hasMany(models.CustomerMeasurements, {
      foreignKey: "saleId",
    });
    Sales.hasOne(models.Receivables, {
      foreignKey: "saleId",
    });
    Sales.hasMany(models.PaymentReceipts, {
      foreignKey: "saleId",
    });
    Sales.hasOne(models.CardTransactions, {
      foreignKey: "saleId",
    });
  }
  return Sales;
};

module.exports = SalesSchema;
