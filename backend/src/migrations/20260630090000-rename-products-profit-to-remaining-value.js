module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("products");

    if (table.profit && !table.remaining_value) {
      await queryInterface.renameColumn("products", "profit", "remaining_value");
    }

    if (table.remaining_value) {
      await queryInterface.changeColumn("products", "remaining_value", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("products");

    if (table.remaining_value && !table.profit) {
      await queryInterface.renameColumn("products", "remaining_value", "profit");
    }

    if (table.profit) {
      await queryInterface.changeColumn("products", "profit", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }
  },
};
