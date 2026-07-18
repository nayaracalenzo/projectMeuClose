module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "financial_categories"
      SET "description" = REGEXP_REPLACE(TRIM(COALESCE("description", '')), '^"+|"+$', '', 'g')
      WHERE TRIM(COALESCE("description", '')) <> REGEXP_REPLACE(TRIM(COALESCE("description", '')), '^"+|"+$', '', 'g');
    `);
  },

  async down() {},
};
