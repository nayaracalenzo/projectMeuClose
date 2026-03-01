const SalesSchema = (sequelize, DataTypes) => {
  const Sales = sequelize.define("Sales", {
    idSale: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customerId: {
      type: DataTypes.INTEGER
    },
    userId: {
      type: DataTypes.INTEGER
    },
    discountType: {
      type: DataTypes.ENUM('PERCENTAGE', 'FIXED'),
      allowNull: true
    },
    discountValue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    finalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM("OPEN", "COMPLETED", "CANCELLED"),
      defaultValue: "OPEN",
    },
    dueDate: {
      type: DataTypes.DATE
    },
  });
  Sales.associate = (models) => {
    Sales.belongsTo(models.Customers, {
      foreignKey: "idCustomer",
    });
    Sales.belongsTo(models.Users, {
      foreignKey: "idUser",
    });
    Sales.hasMany(models.SaleItems, {
      foreignKey: "idSaleItem",
    });
  }
  return Sales;
};

module.exports = SalesSchema;
