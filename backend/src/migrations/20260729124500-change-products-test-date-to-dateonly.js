'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "products"
      ALTER COLUMN "testDate"
      TYPE DATE
      USING ("testDate" AT TIME ZONE 'UTC')::date;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "products"
      ALTER COLUMN "testDate"
      TYPE TIMESTAMP WITH TIME ZONE
      USING ("testDate"::timestamp AT TIME ZONE 'UTC');
    `);
  },
};
