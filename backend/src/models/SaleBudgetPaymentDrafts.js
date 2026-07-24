const SaleBudgetPaymentDraftsSchema = (sequelize, DataTypes) => {
  const SaleBudgetPaymentDrafts = sequelize.define(
    "SaleBudgetPaymentDrafts",
    {
      idSaleBudgetPaymentDraft: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
      paymentTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      installmentCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      installmentIntervalDays: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      receiptFinancialAccountId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      entryAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      entryPaymentTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      entryFinancialAccountId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      entryReferenceCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentReferenceCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      useCustomerCredit: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      customerCreditAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
    },
    {
      tableName: "sale_budget_payment_drafts",
      timestamps: true,
    },
  );

  SaleBudgetPaymentDrafts.associate = (models) => {
    SaleBudgetPaymentDrafts.belongsTo(models.Sales, {
      foreignKey: "saleId",
    });
    SaleBudgetPaymentDrafts.belongsTo(models.PaymentTypes, {
      foreignKey: "paymentTypeId",
      as: "PaymentType",
    });
    SaleBudgetPaymentDrafts.belongsTo(models.PaymentTypes, {
      foreignKey: "entryPaymentTypeId",
      as: "EntryPaymentType",
    });
    SaleBudgetPaymentDrafts.belongsTo(models.FinancialAccounts, {
      foreignKey: "receiptFinancialAccountId",
      as: "ReceiptFinancialAccount",
    });
    SaleBudgetPaymentDrafts.belongsTo(models.FinancialAccounts, {
      foreignKey: "entryFinancialAccountId",
      as: "EntryFinancialAccount",
    });
  };

  return SaleBudgetPaymentDrafts;
};

module.exports = SaleBudgetPaymentDraftsSchema;
