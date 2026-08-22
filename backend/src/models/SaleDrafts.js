const SaleDraftsSchema = (sequelize, DataTypes) => {
  const SaleDrafts = sequelize.define(
    "SaleDrafts",
    {
      idSaleDraft: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "users",
          key: "idUser",
        },
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "CONSUMED", "DISCARDED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      payload: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      lastClientSavedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastServerSavedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "sale_drafts",
      timestamps: true,
    },
  );

  SaleDrafts.associate = (models) => {
    SaleDrafts.belongsTo(models.Users, {
      foreignKey: "userId",
    });
  };

  return SaleDrafts;
};

module.exports = SaleDraftsSchema;
