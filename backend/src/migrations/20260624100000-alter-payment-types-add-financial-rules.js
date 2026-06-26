module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("payment_types");

    if (!table.requiresDueDate) {
      await queryInterface.addColumn("payment_types", "requiresDueDate", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!table.allowsEntryAmount) {
      await queryInterface.addColumn("payment_types", "allowsEntryAmount", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!table.allowedEntryPaymentKinds) {
      await queryInterface.addColumn("payment_types", "allowedEntryPaymentKinds", {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }

    if (!table.allowsInstallments) {
      await queryInterface.addColumn("payment_types", "allowsInstallments", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!table.maxInstallments) {
      await queryInterface.addColumn("payment_types", "maxInstallments", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!table.defaultInstallments) {
      await queryInterface.addColumn("payment_types", "defaultInstallments", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      });
    }

    if (!table.financialFlow) {
      await queryInterface.addColumn("payment_types", "financialFlow", {
        type: Sequelize.ENUM("IMMEDIATE_CASH", "FUTURE_CUSTOMER", "FUTURE_OPERATOR"),
        allowNull: false,
        defaultValue: "IMMEDIATE_CASH",
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("payment_types");

    if (table.financialFlow) {
      await queryInterface.removeColumn("payment_types", "financialFlow");
    }

    if (table.defaultInstallments) {
      await queryInterface.removeColumn("payment_types", "defaultInstallments");
    }

    if (table.maxInstallments) {
      await queryInterface.removeColumn("payment_types", "maxInstallments");
    }

    if (table.allowsInstallments) {
      await queryInterface.removeColumn("payment_types", "allowsInstallments");
    }

    if (table.allowedEntryPaymentKinds) {
      await queryInterface.removeColumn("payment_types", "allowedEntryPaymentKinds");
    }

    if (table.allowsEntryAmount) {
      await queryInterface.removeColumn("payment_types", "allowsEntryAmount");
    }

    if (table.requiresDueDate) {
      await queryInterface.removeColumn("payment_types", "requiresDueDate");
    }
  },
};
