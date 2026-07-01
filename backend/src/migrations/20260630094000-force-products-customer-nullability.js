module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "products" ALTER COLUMN "customerId" DROP NOT NULL;',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "products" ALTER COLUMN "customerId" SET NOT NULL;',
    );
  },
};
