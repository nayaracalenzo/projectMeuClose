const ReceivablesSchema = (sequelize, DataTypes) => {
  const Receivables = sequelize.define(
    "Receivables",
    {
      idReceivable: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      debtorType: {
        type: DataTypes.ENUM("CUSTOMER", "CARD_OPERATOR"),
        allowNull: false,
        defaultValue: "CUSTOMER",
      },
      operatorLabel: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      originalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      openAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("OPEN", "PARTIAL", "PAID", "OVERDUE"),
        allowNull: false,
        defaultValue: "OPEN",
      },
    },
    {
      tableName: "receivables",
      timestamps: true,
    }
  );

  Receivables.associate = (models) => {
    Receivables.belongsTo(models.Sales, {
      foreignKey: "saleId",
    });
    Receivables.belongsTo(models.Customers, {
      foreignKey: "customerId",
    });
    Receivables.hasMany(models.ReceivableInstallments, {
      foreignKey: "receivableId",
    });
    Receivables.hasOne(models.CardTransactions, {
      foreignKey: "receivableId",
    });
  };

  return Receivables;
};

module.exports = ReceivablesSchema;
