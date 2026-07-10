module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_sales_status" RENAME TO "enum_sales_status_old";',
        { transaction },
      );

      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_sales_status" AS ENUM ('ORCAMENTO', 'A_PRODUZIR', 'CONCLUIDO', 'CANCELADO');`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE "sales"
          ALTER COLUMN "status" DROP DEFAULT,
          ALTER COLUMN "status" TYPE "enum_sales_status"
          USING (
            CASE
              WHEN "status"::text = 'OPEN' THEN 'ORCAMENTO'
              WHEN "status"::text = 'COMPLETED' THEN 'CONCLUIDO'
              WHEN "status"::text = 'CANCELLED' THEN 'CANCELADO'
              ELSE 'ORCAMENTO'
            END
          )::"enum_sales_status",
          ALTER COLUMN "status" SET DEFAULT 'ORCAMENTO';
        `,
        { transaction },
      );

      await queryInterface.sequelize.query('DROP TYPE "enum_sales_status_old";', {
        transaction,
      });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_sales_status" RENAME TO "enum_sales_status_new";',
        { transaction },
      );

      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_sales_status" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE "sales"
          ALTER COLUMN "status" DROP DEFAULT,
          ALTER COLUMN "status" TYPE "enum_sales_status"
          USING (
            CASE
              WHEN "status"::text = 'CONCLUIDO' THEN 'COMPLETED'
              WHEN "status"::text = 'CANCELADO' THEN 'CANCELLED'
              ELSE 'OPEN'
            END
          )::"enum_sales_status",
          ALTER COLUMN "status" SET DEFAULT 'OPEN';
        `,
        { transaction },
      );

      await queryInterface.sequelize.query('DROP TYPE "enum_sales_status_new";', {
        transaction,
      });
    });
  },
};
