const RolesSchema = (sequelize, DataTypes) => {
const Roles = sequelize.define(
  "Roles",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    desc: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
  Roles.hasMany(models.Employees, {
    foreignKey: "roleId"
  });
}
return Roles
}

module.exports = RolesSchema;
