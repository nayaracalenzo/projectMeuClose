const ProductsTypesSchema = (sequelize, DataTypes) => {
  const ProductsTypes = sequelize.define(
    "ProductsTypes",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      desc: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: "products_types",
      timestamps: false,
    }
  );

  return ProductsTypes;
};

module.exports = ProductsTypesSchema;
