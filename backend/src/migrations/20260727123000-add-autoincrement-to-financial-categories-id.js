'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE
        current_default text;
      BEGIN
        SELECT column_default
          INTO current_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'financial_categories'
          AND column_name = 'idFinancialCategory';

        IF current_default IS NULL THEN
          EXECUTE 'CREATE SEQUENCE IF NOT EXISTS "financial_categories_idFinancialCategory_seq"';

          EXECUTE '
            SELECT setval(
              ''"financial_categories_idFinancialCategory_seq"'',
              COALESCE((SELECT MAX("idFinancialCategory") FROM "financial_categories"), 0) + 1,
              false
            )
          ';

          EXECUTE '
            ALTER TABLE "financial_categories"
            ALTER COLUMN "idFinancialCategory"
            SET DEFAULT nextval(''"financial_categories_idFinancialCategory_seq"'')
          ';

          EXECUTE '
            ALTER SEQUENCE "financial_categories_idFinancialCategory_seq"
            OWNED BY "financial_categories"."idFinancialCategory"
          ';
        END IF;
      END $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "financial_categories"
      ALTER COLUMN "idFinancialCategory" DROP DEFAULT;
    `);

    await queryInterface.sequelize.query(`
      DROP SEQUENCE IF EXISTS "financial_categories_idFinancialCategory_seq";
    `);
  },
};
