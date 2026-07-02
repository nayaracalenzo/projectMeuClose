"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("payment_receipts");

    if (!table.receiptType) {
      await queryInterface.addColumn("payment_receipts", "receiptType", {
        type: Sequelize.ENUM("ENTRY", "SALE_FULL", "INSTALLMENT"),
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE payment_receipts AS pr
      SET "receiptType" = CASE
        WHEN pr."receivableInstallmentId" IS NOT NULL THEN 'INSTALLMENT'::"enum_payment_receipts_receiptType"
        WHEN EXISTS (
          SELECT 1
          FROM receivables r
          WHERE r."saleId" = pr."saleId"
        ) THEN 'ENTRY'::"enum_payment_receipts_receiptType"
        ELSE 'SALE_FULL'::"enum_payment_receipts_receiptType"
      END
      WHERE pr."receiptType" IS NULL
    `);

    await queryInterface.changeColumn("payment_receipts", "receiptType", {
      type: Sequelize.ENUM("ENTRY", "SALE_FULL", "INSTALLMENT"),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("payment_receipts");

    if (table.receiptType) {
      await queryInterface.removeColumn("payment_receipts", "receiptType");
    }

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_payment_receipts_receiptType";',
    );
  },
};
