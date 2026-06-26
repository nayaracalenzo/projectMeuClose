module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("receivables");

    if (table.customerId && table.customerId.allowNull === false) {
      await queryInterface.changeColumn("receivables", "customerId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "customers",
          key: "idCustomer",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });
    }

    if (!table.debtorType) {
      await queryInterface.addColumn("receivables", "debtorType", {
        type: Sequelize.ENUM("CUSTOMER", "CARD_OPERATOR"),
        allowNull: false,
        defaultValue: "CUSTOMER",
      });
    }

    if (!table.operatorLabel) {
      await queryInterface.addColumn("receivables", "operatorLabel", {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("receivables");

    if (table.operatorLabel) {
      await queryInterface.removeColumn("receivables", "operatorLabel");
    }

    if (table.debtorType) {
      await queryInterface.removeColumn("receivables", "debtorType");
    }

    if (table.customerId && table.customerId.allowNull === true) {
      await queryInterface.changeColumn("receivables", "customerId", {
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
