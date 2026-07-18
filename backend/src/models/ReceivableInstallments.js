const ReceivableInstallmentsSchema = (sequelize, DataTypes) => {
  const ReceivableInstallments = sequelize.define(
    "ReceivableInstallments",
    {
      idReceivableInstallment: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      receivableId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      paymentTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      installmentNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      totalInstallments: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      interestBaseDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      paidAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM("OPEN", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"),
        allowNull: false,
        defaultValue: "OPEN",
      },
    },
    {
      tableName: "receivable_installments",
      timestamps: true,
    }
  );

  ReceivableInstallments.associate = (models) => {
    ReceivableInstallments.belongsTo(models.Receivables, {
      foreignKey: "receivableId",
    });
    ReceivableInstallments.belongsTo(models.PaymentTypes, {
      foreignKey: "paymentTypeId",
    });
    ReceivableInstallments.hasMany(models.PaymentReceipts, {
      foreignKey: "receivableInstallmentId",
    });
  };

  return ReceivableInstallments;
};

module.exports = ReceivableInstallmentsSchema;
