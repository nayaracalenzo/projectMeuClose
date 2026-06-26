const PayablesSchema = (sequelize, DataTypes) => {
  const Payables = sequelize.define(
    "Payables",
    {
      idPayable: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      scope: {
        type: DataTypes.ENUM("LOJA", "PESSOAL"),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      beneficiary: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      openAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("OPEN", "PARTIAL", "PAID", "OVERDUE"),
        allowNull: false,
        defaultValue: "OPEN",
      },
      settlementTarget: {
        type: DataTypes.ENUM("BANCO", "CAIXA"),
        allowNull: false,
      },
      accountLabel: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      plannedPaymentTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "payables",
      timestamps: true,
    }
  );

  Payables.associate = (models) => {
    Payables.belongsTo(models.PaymentTypes, {
      foreignKey: "plannedPaymentTypeId",
    });
    Payables.hasMany(models.PayablePayments, {
      foreignKey: "payableId",
    });
  };

  return Payables;
};

module.exports = PayablesSchema;
