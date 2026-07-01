module.exports = {
  async up(queryInterface, Sequelize) {
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
  },

  async down(queryInterface, Sequelize) {
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
  },
};
