const ProductsSchema = (sequelize, DataTypes) => {
  const Products = sequelize.define(
    "Products",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      desc: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      employeeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      statusId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      productTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      clothingTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      colorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      fabricId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      sizeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      testDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      qtyStock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      dressmakerValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      finalValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      profit: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
    },
    {
      tableName: "products",
      timestamps: true,
    },
  );

  Products.associate = (models) => {
    Products.belongsTo(models.Sales, {
      foreignKey: "saleId",
    });
    Products.belongsTo(models.Customers, {
      foreignKey: "customerId",
    });
    Products.belongsTo(models.Employees, {
      foreignKey: "employeeId",
    });
    Products.belongsTo(models.Status, {
      foreignKey: "statusId",
    });
    Products.belongsTo(models.ProductsTypes, {
      foreignKey: "productTypeId",
    });
    Products.belongsTo(models.ClothingsType, {
      foreignKey: "clothingTypeId",
    });
    Products.belongsTo(models.Colors, {
      foreignKey: "colorId",
    });
    Products.belongsTo(models.Fabrics, {
      foreignKey: "fabricId",
    });
    Products.belongsTo(models.Sizes, {
      foreignKey: "sizeId",
    });
    Products.hasMany(models.SaleItems, {
      foreignKey: "productId",
    });
  };

  return Products;
};

module.exports = ProductsSchema;
