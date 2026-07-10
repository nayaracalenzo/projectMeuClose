module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'enum_sale_items_itemType_new'
        ) THEN
          CREATE TYPE "enum_sale_items_itemType_new" AS ENUM (
            'READY_MADE',
            'CUSTOM_MADE',
            'ACCESSORY',
            'SERVICE',
            'MISC'
          );
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "sale_items"
      ALTER COLUMN "itemType" TYPE "enum_sale_items_itemType_new"
      USING "itemType"::text::"enum_sale_items_itemType_new";
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_sale_items_itemType";
    `);

    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_sale_items_itemType_new" RENAME TO "enum_sale_items_itemType";
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'enum_sale_items_itemType_old'
        ) THEN
          CREATE TYPE "enum_sale_items_itemType_old" AS ENUM (
            'READY_MADE',
            'CUSTOM_MADE'
          );
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "sale_items"
      ALTER COLUMN "itemType" TYPE "enum_sale_items_itemType_old"
      USING (
        CASE
          WHEN "itemType"::text IN ('READY_MADE', 'CUSTOM_MADE')
            THEN "itemType"::text
          ELSE 'READY_MADE'
        END
      )::"enum_sale_items_itemType_old";
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_sale_items_itemType";
    `);

    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_sale_items_itemType_old" RENAME TO "enum_sale_items_itemType";
    `);
  },
};
