const EmployeesSchema = (sequelize, DataTypes) => {
  const Employees = sequelize.define(
    "Employees",
    {
      idEmployee: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      fullName: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      shortName: {
        type: DataTypes.STRING(60),
        allowNull: false,
        unique: true,
      },
      document: {
        type: DataTypes.STRING(14),
        allowNull: true,
        unique: true,
        validate: {
          isCpfOrCnpj(value) {
            if (value == null || value === "") return;

            if (!/^\d{11}$|^\d{14}$/.test(value)) {
              throw new Error("Document deve conter 11 ou 14 digitos.");
            }
          },
        },
      },
      rg: {
        type: DataTypes.STRING(20),
        allowNull: true,
        unique: true,
      },
      zipCode: {
        type: DataTypes.STRING(8),
        allowNull: true,
      },
      street: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      number: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      complement: {
        type: DataTypes.STRING(100),
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
      primaryPhone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      secondaryPhone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      nameSecPhone: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(120),
        allowNull: true,
        unique: true,
        validate: {
          hasAtSymbol(value) {
            if (value == null || value === "") return;

            if (!String(value).includes("@")) {
              throw new Error("Email deve conter @.");
            }
          },
          isEmail: true,
        },
      },
      comment: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      birthDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      roleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "roles",
          key: "id",
        },
      },
      bankData: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      dsbl: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "employees",
      timestamps: true,
    }
  );

  Employees.associate = (models) => {
    Employees.belongsTo(models.Roles, {
      foreignKey: "roleId",
    });
  };

  return Employees;
};

module.exports = EmployeesSchema;
