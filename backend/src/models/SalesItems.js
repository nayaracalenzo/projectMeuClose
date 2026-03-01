const SaleItemsSchema = (sequelize, DataTypes) => {
  const SaleItems = sequelize.define("SaleItems", {
    idSaleItem: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    saleId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false
    },
    discountType: {
      type: DataTypes.ENUM('PERCENTAGE', 'FIXED'),
      allowNull: true
    },
    discountValue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    }
  });
  return SaleItems
};

module.exports = SaleItemsSchema