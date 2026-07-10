module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      SELECT setval(
        pg_get_serial_sequence('"professions"', 'idProfession'),
        COALESCE((SELECT MAX("idProfession") FROM "professions"), 0),
        true
      );
    `);
  },

  async down() {
    // noop
  },
};
