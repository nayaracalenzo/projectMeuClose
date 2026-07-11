const AuditsSchema = (sequelize, DataTypes) => {
  const Audits = sequelize.define(
    "Audits",
    {
      idAudit: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      auditTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      occurredAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      history: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      legacyFingerprint: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: "audits",
      timestamps: true,
    },
  );

  Audits.associate = (models) => {
    Audits.belongsTo(models.AuditTypes, {
      foreignKey: "auditTypeId",
    });
    Audits.belongsTo(models.Users, {
      foreignKey: "userId",
    });
  };

  return Audits;
};

module.exports = AuditsSchema;
