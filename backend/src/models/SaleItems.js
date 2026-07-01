const SaleItemsSchema = (sequelize, DataTypes) => {
  const SaleItems = sequelize.define(
    "SaleItems",
    {
      idSaleItem: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      itemType: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false,
      },
      discountType: {
        type: DataTypes.ENUM("PERCENTAGE", "FIXED"),
        allowNull: true,
      },
      discountValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
    },
    {
      tableName: "sale_items",
      timestamps: true,
    }
  );

  SaleItems.associate = (models) => {
    SaleItems.belongsTo(models.Sales, {
      foreignKey: "saleId",
    });
    SaleItems.belongsTo(models.Products, {
      foreignKey: "productId",
    });
  };

  return SaleItems
};

module.exports = SaleItemsSchema
