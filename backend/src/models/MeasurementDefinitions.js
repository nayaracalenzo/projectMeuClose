const MeasurementDefinitionsSchema = (sequelize, DataTypes) => {
  const MeasurementDefinitions = sequelize.define(
    "MeasurementDefinitions",
    {
      idMeasurementDefinition: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      key: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
      },
      label: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "measurement_definitions",
      timestamps: true,
    },
  );

  MeasurementDefinitions.associate = (models) => {
    MeasurementDefinitions.hasMany(models.CustomerMeasurementValues, {
      foreignKey: "measurementDefinitionId",
    });
  };

  return MeasurementDefinitions;
};

module.exports = MeasurementDefinitionsSchema;
