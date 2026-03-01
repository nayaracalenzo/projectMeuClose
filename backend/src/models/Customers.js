

const CustomersSchema = (sequelize, DataTypes) => {
  const Customers = sequelize.define("Customers", {
    idCustomer: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    typeCustomer: {
      type: DataTypes.ENUM('INDIVIDUAL', 'COMPANY'),
      allowNull: false,
    },
    document: {
      type: DataTypes.STRING(14),
      unique: true,
    },
    rg: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    fullName: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    birthDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    companyName: {
      type: DataTypes.STRING(150),
    },
    tradeName: {
      type: DataTypes.STRING(150),
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(120),
    }, 
    zipCode: {
      type: DataTypes.STRING(8)
    },
    street: {
      type: DataTypes.STRING(150)
    },
    number: {
      type: DataTypes.STRING(10)
    },
    complement: {
      type: DataTypes.STRING(100)
    },
    city: {
      type: DataTypes.STRING(100)
    },
    state: {
      type: DataTypes.STRING(2)
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    blocked: {
      type: DataTypes.BOOLEAN,
    },
    professionId: {
      type: DataTypes.INTEGER,
    },
    comment: {
      type: DataTypes.STRING(100),
    },
  },
    {
      tableName: 'customers',
      timestamps: true
    }
);
  Customers.associate = (models) => {
    Customers.hasMany(models.Sales, {
      foreignKey: "customerId"
    });
    Customers.belongsTo(models.Professions, {
      foreignKey: "professionId",
    });
  }
  return Customers
};

module.exports = CustomersSchema