module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("products");

    if (table.saleId) {
      await queryInterface.removeColumn("products", "saleId");
    }

    if (table.customerId && table.customerId.allowNull === false) {
      await queryInterface.changeColumn("products", "customerId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "customers",
          key: "idCustomer",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("products");

    if (!table.saleId) {
      await queryInterface.addColumn("products", "saleId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    }

    if (table.customerId && table.customerId.allowNull === true) {
      await queryInterface.changeColumn("products", "customerId", {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "customers",
          key: "idCustomer",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });
    }
  },
};
