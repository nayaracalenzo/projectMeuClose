const PurchasePendingsSchema = (sequelize, DataTypes) => {
  const PurchasePendings = sequelize.define(
    "PurchasePendings",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      done: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "purchase_pendings",
      timestamps: true,
    },
  );

  return PurchasePendings;
};

module.exports = PurchasePendingsSchema;
