const ProfessionSchema = (sequelize, DataTypes) => {
  const Professions = sequelize.define(
    "Professions",
    {
      idProfession: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      nameProfession: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
    },
    {
      tableName: "professions",
      timestamps: false
    }
  );

  Professions.associate = (models) => {
    Professions.hasMany(models.Customers, {
      foreignKey: "professionId",
    });
  }
  return Professions
}

module.exports = ProfessionSchema