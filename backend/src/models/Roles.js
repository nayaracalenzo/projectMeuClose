const RolesSchema = (sequelize, DataTypes) => {
const Roles = sequelize.define(
  "Roles",
  {
    idRole: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "roles",
    timestamps: false,
  }
);

Roles.associate = (models) => {
  Roles.hasMany(models.Users, {
    foreignKey: "roleId"
  });
}
return Roles
}

module.exports = RolesSchema;