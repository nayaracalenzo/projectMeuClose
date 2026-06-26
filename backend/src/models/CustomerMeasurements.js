const CustomerMeasurementsSchema = (sequelize, DataTypes) => {
  const CustomerMeasurements = sequelize.define(
    "CustomerMeasurements",
    {
      idMeasurement: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      costas: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      comprimentoSaia: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      comprimentoBlusa: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      comprimentoCalca: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      comprimentoManga: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      comprimentoVestido: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      comprimentoBermuda: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      cos: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      colete: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      perna: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      braco: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      alturaBusto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      busto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      cintura: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      coice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      cinturaBaixa: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      quadril: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      gancho: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
    },
    {
      tableName: "customer_measurements",
      timestamps: true,
    }
  );

  CustomerMeasurements.associate = (models) => {
    CustomerMeasurements.belongsTo(models.Customers, {
      foreignKey: "customerId",
    });
    CustomerMeasurements.belongsTo(models.Sales, {
      foreignKey: "saleId",
    });
  };

  return CustomerMeasurements;
};

module.exports = CustomerMeasurementsSchema;
