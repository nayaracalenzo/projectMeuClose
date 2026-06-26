module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("payment_types");

    if (!table.kind) {
      await queryInterface.addColumn("payment_types", "kind", {
        type: Sequelize.ENUM("CASH", "CHECK", "BOOKLET", "INVOICE", "CARD"),
        allowNull: true,
      });
    }

    if (!table.active) {
      await queryInterface.addColumn("payment_types", "active", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    if (!table.createdAt) {
      await queryInterface.addColumn("payment_types", "createdAt", {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      });
    }

    if (!table.updatedAt) {
      await queryInterface.addColumn("payment_types", "updatedAt", {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("payment_types");

    if (table.updatedAt) {
      await queryInterface.removeColumn("payment_types", "updatedAt");
    }

    if (table.createdAt) {
      await queryInterface.removeColumn("payment_types", "createdAt");
    }

    if (table.active) {
      await queryInterface.removeColumn("payment_types", "active");
    }

    if (table.kind) {
      await queryInterface.removeColumn("payment_types", "kind");
    }
  },
};
