const CustomerMeasurementValuesSchema = (sequelize, DataTypes) => {
  const CustomerMeasurementValues = sequelize.define(
    "CustomerMeasurementValues",
    {
      idCustomerMeasurementValue: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      measurementDefinitionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
    },
    {
      tableName: "customer_measurement_values",
      timestamps: true,
    },
  );

  CustomerMeasurementValues.associate = (models) => {
    CustomerMeasurementValues.belongsTo(models.Customers, {
      foreignKey: "customerId",
    });
    CustomerMeasurementValues.belongsTo(models.Sales, {
      foreignKey: "saleId",
    });
    CustomerMeasurementValues.belongsTo(models.MeasurementDefinitions, {
      foreignKey: "measurementDefinitionId",
    });
  };

  return CustomerMeasurementValues;
};

module.exports = CustomerMeasurementValuesSchema;
