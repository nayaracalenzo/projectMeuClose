const CashSessionsSchema = (sequelize, DataTypes) => {
  const CashSessions = sequelize.define(
    "CashSessions",
    {
      idCashSession: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("OPEN", "CLOSED"),
        allowNull: false,
        defaultValue: "OPEN",
      },
      openedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      closedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      openingBalance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      expectedBalance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      countedBalance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      differenceAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      openedByUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      closedByUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "cash_sessions",
      timestamps: true,
    },
  );

  CashSessions.associate = (models) => {
    CashSessions.belongsTo(models.Users, {
      foreignKey: "openedByUserId",
      as: "OpenedByUser",
    });
    CashSessions.belongsTo(models.Users, {
      foreignKey: "closedByUserId",
      as: "ClosedByUser",
    });
    CashSessions.hasMany(models.CashEntries, {
      foreignKey: "cashSessionId",
    });
  };

  return CashSessions;
};

module.exports = CashSessionsSchema;
