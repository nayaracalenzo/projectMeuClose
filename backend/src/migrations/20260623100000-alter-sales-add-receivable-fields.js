module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("sales");

    if (!table.paymentTypeId) {
      await queryInterface.addColumn("sales", "paymentTypeId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "payment_types",
          key: "idPaymentType",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    if (!table.installmentCount) {
      await queryInterface.addColumn("sales", "installmentCount", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("sales");

    if (table.installmentCount) {
      await queryInterface.removeColumn("sales", "installmentCount");
    }

    if (table.paymentTypeId) {
      await queryInterface.removeColumn("sales", "paymentTypeId");
    }
  },
};
