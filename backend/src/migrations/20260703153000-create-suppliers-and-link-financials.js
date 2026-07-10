module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("suppliers", {
      idSupplier: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      fullName: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      tradeName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      contactName: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      document: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      rg: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      street: {
        type: Sequelize.STRING(180),
        allowNull: true,
      },
      neighborhood: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(2),
        allowNull: true,
      },
      zipCode: {
        type: Sequelize.STRING(8),
        allowNull: true,
      },
      phoneCommercial1: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      phoneCommercial2: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      fax: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      phoneMobile: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      blocked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    await queryInterface.addColumn("payables", "supplierId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "suppliers",
        key: "idSupplier",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("receivables", "supplierId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "suppliers",
        key: "idSupplier",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("receivables", "supplierId");
    await queryInterface.removeColumn("payables", "supplierId");
    await queryInterface.dropTable("suppliers");
  },
};
