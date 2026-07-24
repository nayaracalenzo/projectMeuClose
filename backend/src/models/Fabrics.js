const FabricsSchema = (sequelize, DataTypes) => {
  const Fabrics = sequelize.define(
    "Fabrics",
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
      tableName: "fabrics",
      timestamps: false,
    }
  );

  return Fabrics;
};

module.exports = FabricsSchema;
