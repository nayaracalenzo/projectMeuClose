module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("products", "dsbl", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.sequelize.query(`
      UPDATE "products"
      SET "dsbl" = true
      WHERE "testDate" IS NOT NULL
        AND DATE("testDate") <= DATE '2016-12-31';
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("products", "dsbl");
  },
};
