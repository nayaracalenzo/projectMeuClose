const SizesSchema = (sequelize, DataTypes) => {
  const Sizes = sequelize.define(
    "Sizes",
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
      dsbl: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "sizes",
      timestamps: false,
    }
  );

  return Sizes;
};

module.exports = SizesSchema;
