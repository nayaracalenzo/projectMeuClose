module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "payment_receipts"
      ALTER COLUMN "receivableInstallmentId" DROP NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "payment_receipts"
      ALTER COLUMN "receivableInstallmentId" SET NOT NULL;
    `);
  },
};
