module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("receivable_installments");
    if (!table.waivedAmount) {
      await queryInterface.addColumn("receivable_installments", "waivedAmount", {
        type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0,
      });
    }
  },
  async down(queryInterface) {
    const table = await queryInterface.describeTable("receivable_installments");
    if (table.waivedAmount) await queryInterface.removeColumn("receivable_installments", "waivedAmount");
  },
};
