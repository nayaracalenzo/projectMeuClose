module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO "status" ("id", "desc")
      VALUES (5, 'atrasada')
      ON CONFLICT ("id") DO UPDATE
      SET "desc" = EXCLUDED."desc";
    `);

    await queryInterface.sequelize.query(`
      UPDATE "products"
      SET "statusId" = 5,
          "updatedAt" = NOW()
      WHERE "statusId" = 1
        AND "testDate" IS NOT NULL
        AND DATE("testDate") < CURRENT_DATE;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "products"
      SET "statusId" = 1,
          "updatedAt" = NOW()
      WHERE "statusId" = 5
        AND "testDate" IS NOT NULL
        AND DATE("testDate") < CURRENT_DATE;
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM "status" WHERE "id" = 5;
    `);
  },
};
