module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("products", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      saleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      desc: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      customerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "customers",
          key: "idCustomer",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      employeeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "employees",
          key: "idEmployee",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      statusId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "status",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      productTypeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "products_types",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      clothingTypeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "clothings_type",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      colorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "colors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fabricId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "fabrics",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      sizeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "sizes",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      testDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      qtyStock: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      dressmakerValue: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      finalValue: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      profit: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("products");
  },
};
