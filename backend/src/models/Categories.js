const CategoriesSchema = (sequelize, DataTypes) => {
  const Categories = sequelize.define(
    "Categories",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      desc: {
        type: DataTypes.STRING(60),
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: "categories",
      timestamps: false,
    },
  );

  return Categories;
};

module.exports = CategoriesSchema;
