const FinancialCategoriesSchema = (sequelize, DataTypes) => {
  const FinancialCategories = sequelize.define(
    "FinancialCategories",
    {
      idFinancialCategory: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      tableName: "financial_categories",
      timestamps: true,
    },
  );

  FinancialCategories.associate = (models) => {
    FinancialCategories.hasMany(models.CashEntries, {
      foreignKey: "financialCategoryId",
    });
    FinancialCategories.hasMany(models.BankEntries, {
      foreignKey: "financialCategoryId",
    });
  };

  return FinancialCategories;
};

module.exports = FinancialCategoriesSchema;
