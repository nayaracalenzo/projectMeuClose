module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_sales_status" RENAME TO "enum_sales_status_old";',
        { transaction },
      );

      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_sales_status" AS ENUM ('BUDGET', 'COMPLETED', 'CANCELLED');`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE "sales"
          ALTER COLUMN "status" DROP DEFAULT,
          ALTER COLUMN "status" TYPE "enum_sales_status"
          USING (
            CASE
              WHEN "status"::text = 'ORCAMENTO' THEN 'BUDGET'
              WHEN "status"::text = 'A_PRODUZIR' THEN 'COMPLETED'
              WHEN "status"::text = 'CONCLUIDO' THEN 'COMPLETED'
              WHEN "status"::text = 'CANCELADO' THEN 'CANCELLED'
              WHEN "status"::text = 'OPEN' THEN 'BUDGET'
              WHEN "status"::text = 'COMPLETED' THEN 'COMPLETED'
              WHEN "status"::text = 'CANCELLED' THEN 'CANCELLED'
              ELSE 'BUDGET'
            END
          )::"enum_sales_status",
          ALTER COLUMN "status" SET DEFAULT 'BUDGET';
        `,
        { transaction },
      );

      await queryInterface.sequelize.query('DROP TYPE "enum_sales_status_old";', {
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_sales_status" RENAME TO "enum_sales_status_new";',
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
              WHEN "status"::text = 'BUDGET' THEN 'ORCAMENTO'
              WHEN "status"::text = 'CANCELLED' THEN 'CANCELADO'
              ELSE 'CONCLUIDO'
            END
          )::"enum_sales_status",
          ALTER COLUMN "status" SET DEFAULT 'ORCAMENTO';
        `,
        { transaction },
      );

      await queryInterface.sequelize.query('DROP TYPE "enum_sales_status_new";', {
        transaction,
      });
    });
  },
};
