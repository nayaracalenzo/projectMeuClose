

const UsersSchema = (sequelize, DataTypes) => {
const Users = sequelize.define(
  "Users",
  {
    idUser: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },
    username: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    roleId: {
      type: DataTypes.INTEGER,

      allowNull: false,
      references: {
        model: 'roles', 
        key: 'idRole',
      },
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
  tableName: "users",
  timestamps: false
  }
);

Users.associate = (models) => {
  Users.belongsTo(models.Roles, {
    foreignKey: "roleId",
  });
}
return Users
}

module.exports = UsersSchema