'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "customers"
      SET "document" = NULL
      WHERE TRIM(COALESCE("document", '')) = '';
    `);
  },

  async down() {},
};
