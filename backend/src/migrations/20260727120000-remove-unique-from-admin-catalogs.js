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

async function addUniqueConstraintIfMissing(queryInterface, tableName, columnName, constraintName) {
  const [constraints] = await queryInterface.sequelize.query(
    `
      SELECT 1
      FROM information_schema.table_constraints AS tc
      INNER JOIN information_schema.constraint_column_usage AS ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
        AND tc.table_name = :tableName
        AND ccu.column_name = :columnName
      LIMIT 1;
    `,
    {
      replacements: { tableName, columnName },
    },
  );

  if (constraints.length > 0) {
    return;
  }

  await queryInterface.addConstraint(tableName, {
    fields: [columnName],
    type: 'unique',
    name: constraintName,
  });
}

module.exports = {
  async up(queryInterface) {
    await dropUniqueConstraintsForColumn(queryInterface, 'colors', 'desc');
    await dropUniqueConstraintsForColumn(queryInterface, 'fabrics', 'desc');
    await dropUniqueConstraintsForColumn(queryInterface, 'clothings_type', 'desc');
    await dropUniqueConstraintsForColumn(queryInterface, 'financial_categories', 'description');
  },

  async down(queryInterface) {
    await addUniqueConstraintIfMissing(queryInterface, 'colors', 'desc', 'colors_desc_key');
    await addUniqueConstraintIfMissing(queryInterface, 'fabrics', 'desc', 'fabrics_desc_key');
    await addUniqueConstraintIfMissing(queryInterface, 'clothings_type', 'desc', 'clothings_type_desc_key');
    await addUniqueConstraintIfMissing(
      queryInterface,
      'financial_categories',
      'description',
      'financial_categories_description_key',
    );
  },
};
