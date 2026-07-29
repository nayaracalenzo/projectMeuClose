'use strict';

async function dropUniqueConstraintsForColumn(queryInterface, tableName, columnName) {
  const [constraints] = await queryInterface.sequelize.query(
    `
      SELECT tc.constraint_name
      FROM information_schema.table_constraints AS tc
      INNER JOIN information_schema.constraint_column_usage AS ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
        AND tc.table_name = :tableName
        AND ccu.column_name = :columnName;
    `,
    {
      replacements: { tableName, columnName },
    },
  );

  for (const constraint of constraints) {
    if (!constraint?.constraint_name) {
      continue;
    }

    await queryInterface.removeConstraint(tableName, constraint.constraint_name);
  }
}

async function ensureSequence(queryInterface, tableName, primaryKeyColumn, sequenceName) {
  await queryInterface.sequelize.query(
    `
      CREATE SEQUENCE IF NOT EXISTS "${sequenceName}";
    `,
  );

  await queryInterface.sequelize.query(
    `
      SELECT setval(
        '"${sequenceName}"',
        COALESCE((SELECT MAX("${primaryKeyColumn}") FROM "${tableName}"), 0) + 1,
        false
      );
    `,
  );

  await queryInterface.sequelize.query(
    `
      ALTER TABLE "${tableName}"
      ALTER COLUMN "${primaryKeyColumn}"
      SET DEFAULT nextval('"${sequenceName}"');
    `,
  );

  await queryInterface.sequelize.query(
    `
      ALTER SEQUENCE "${sequenceName}"
      OWNED BY "${tableName}"."${primaryKeyColumn}";
    `,
  );
}

module.exports = {
  async up(queryInterface) {
    await dropUniqueConstraintsForColumn(queryInterface, 'colors', 'desc');
    await dropUniqueConstraintsForColumn(queryInterface, 'fabrics', 'desc');
    await dropUniqueConstraintsForColumn(queryInterface, 'clothings_type', 'desc');
    await dropUniqueConstraintsForColumn(queryInterface, 'sizes', 'desc');
    await dropUniqueConstraintsForColumn(queryInterface, 'financial_categories', 'description');

    await ensureSequence(queryInterface, 'colors', 'id', 'colors_id_seq');
    await ensureSequence(queryInterface, 'fabrics', 'id', 'fabrics_id_seq');
    await ensureSequence(queryInterface, 'clothings_type', 'id', 'clothings_type_id_seq');
    await ensureSequence(queryInterface, 'sizes', 'id', 'sizes_id_seq');
    await ensureSequence(
      queryInterface,
      'financial_categories',
      'idFinancialCategory',
      'financial_categories_idFinancialCategory_seq',
    );
  },

  async down() {
    // Reversão automática de unicidade e sequence não é aplicada aqui para evitar recriar
    // restrições antigas em bases que já possuem dados duplicados válidos.
  },
};
