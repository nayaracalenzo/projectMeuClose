const AuditTypesSchema = (sequelize, DataTypes) => {
  const AuditTypes = sequelize.define(
    "AuditTypes",
    {
      idAuditType: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      tableName: "audit_types",
      timestamps: true,
    },
  );

  AuditTypes.associate = (models) => {
    AuditTypes.hasMany(models.Audits, {
      foreignKey: "auditTypeId",
    });
  };

  return AuditTypes;
};

module.exports = AuditTypesSchema;
