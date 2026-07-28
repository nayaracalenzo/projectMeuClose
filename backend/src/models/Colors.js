const ColorsSchema = (sequelize, DataTypes) => {
  const Colors = sequelize.define(
    "Colors",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      desc: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      dsbl: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "colors",
      timestamps: false,
    }
  );

  return Colors;
};

module.exports = ColorsSchema;
