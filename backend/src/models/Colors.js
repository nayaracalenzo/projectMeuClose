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
        unique: true,
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
