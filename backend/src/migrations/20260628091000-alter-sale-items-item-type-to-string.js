module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "sale_items"
      ALTER COLUMN "itemType" TYPE VARCHAR(30)
      USING "itemType"::text
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_sale_items_itemType"
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_sale_items_itemType" AS ENUM (
        'READY_MADE',
        'CUSTOM_MADE',
        'ACCESSORY',
        'SERVICE',
        'MISC'
      )
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "sale_items"
      ALTER COLUMN "itemType" TYPE "enum_sale_items_itemType"
      USING "itemType"::"enum_sale_items_itemType"
    `);
  },
};
