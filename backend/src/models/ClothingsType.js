const ClothingsTypeSchema = (sequelize, DataTypes) => {
  const ClothingsType = sequelize.define(
    "ClothingsType",
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
      tableName: "clothings_type",
      timestamps: false,
    }
  );

  return ClothingsType;
};

module.exports = ClothingsTypeSchema;
