"use strict";

async function getImageDataType(queryInterface) {
  const [rows] = await queryInterface.sequelize.query(`
    SELECT data_type AS "dataType"
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'garment_reference_images'
      AND column_name = 'imageData'
    LIMIT 1
  `);

  return rows[0]?.dataType || null;
}

module.exports = {
  async up(queryInterface) {
    const dataType = await getImageDataType(queryInterface);

    if (dataType !== "bytea") {
      return;
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE garment_reference_images
      ALTER COLUMN "imageData" TYPE TEXT
      USING encode("imageData", 'base64')
    `);
  },

  async down(queryInterface) {
    const dataType = await getImageDataType(queryInterface);

    if (dataType !== "text") {
      return;
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE garment_reference_images
      ALTER COLUMN "imageData" TYPE BYTEA
      USING decode("imageData", 'base64')
    `);
  },
};
