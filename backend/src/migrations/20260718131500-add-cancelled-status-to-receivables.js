module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumlabel = 'CANCELLED'
            AND enumtypid = 'enum_receivables_status'::regtype
        ) THEN
          ALTER TYPE "enum_receivables_status" ADD VALUE 'CANCELLED';
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumlabel = 'CANCELLED'
            AND enumtypid = 'enum_receivable_installments_status'::regtype
        ) THEN
          ALTER TYPE "enum_receivable_installments_status" ADD VALUE 'CANCELLED';
        END IF;
      END $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          UPDATE "receivables"
          SET "status" = 'OPEN'
          WHERE "status" = 'CANCELLED';
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          UPDATE "receivable_installments"
          SET "status" = 'OPEN'
          WHERE "status" = 'CANCELLED';
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TYPE "enum_receivables_status" RENAME TO "enum_receivables_status_old";
          CREATE TYPE "enum_receivables_status" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'OVERDUE');
          ALTER TABLE "receivables"
            ALTER COLUMN "status" TYPE "enum_receivables_status"
            USING "status"::text::"enum_receivables_status";
          DROP TYPE "enum_receivables_status_old";
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TYPE "enum_receivable_installments_status" RENAME TO "enum_receivable_installments_status_old";
          CREATE TYPE "enum_receivable_installments_status" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'OVERDUE');
          ALTER TABLE "receivable_installments"
            ALTER COLUMN "status" TYPE "enum_receivable_installments_status"
            USING "status"::text::"enum_receivable_installments_status";
          DROP TYPE "enum_receivable_installments_status_old";
        `,
        { transaction },
      );
    });
  },
};
