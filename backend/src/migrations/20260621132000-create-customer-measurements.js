module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("customer_measurements", {
      idMeasurement: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
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
        onDelete: "CASCADE",
      },
      saleId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      costas: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      comprimentoSaia: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      comprimentoBlusa: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      comprimentoCalca: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      comprimentoManga: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      comprimentoVestido: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      comprimentoBermuda: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      cos: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      colete: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      perna: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      braco: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      alturaBusto: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      busto: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      cintura: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      coice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      cinturaBaixa: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      quadril: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      gancho: {
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
    await queryInterface.dropTable("customer_measurements");
  },
};
