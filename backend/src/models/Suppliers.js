const SuppliersSchema = (sequelize, DataTypes) => {
  const Suppliers = sequelize.define(
    "Suppliers",
    {
      idSupplier: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      fullName: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      tradeName: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      contactName: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      document: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      rg: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      street: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      neighborhood: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING(2),
        allowNull: true,
      },
      zipCode: {
        type: DataTypes.STRING(8),
        allowNull: true,
      },
      phoneCommercial1: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      phoneCommercial2: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      fax: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      phoneMobile: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      blocked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "suppliers",
      timestamps: true,
    }
  );

  Suppliers.associate = (models) => {
    Suppliers.hasMany(models.Payables, {
      foreignKey: "supplierId",
    });
    Suppliers.hasMany(models.Receivables, {
      foreignKey: "supplierId",
    });
  };

  return Suppliers;
};

module.exports = SuppliersSchema;
