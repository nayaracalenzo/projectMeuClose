const FinancialAccountsSchema = (sequelize, DataTypes) => {
  const FinancialAccounts = sequelize.define(
    "FinancialAccounts",
    {
      idFinancialAccount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      desc: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      scope: {
        type: DataTypes.ENUM("LOJA", "PESSOAL"),
        allowNull: false,
      },
      targetType: {
        type: DataTypes.ENUM("CASH", "BANK"),
        allowNull: false,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      dsbl: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "financial_accounts",
      timestamps: true,
    },
  );

  return FinancialAccounts;
};

module.exports = FinancialAccountsSchema;
