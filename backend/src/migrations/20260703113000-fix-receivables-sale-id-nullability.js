module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.sequelize.query(
        'ALTER TABLE "receivables" ALTER COLUMN "saleId" DROP NOT NULL;',
        { transaction },
      );

      const [constraints] = await queryInterface.sequelize.query(
        `
          SELECT conname, pg_get_constraintdef(oid) AS definition
          FROM pg_constraint
          WHERE conrelid = 'receivables'::regclass
            AND contype = 'f'
            AND conname LIKE 'receivables_saleId_fkey%';
        `,
        { transaction },
      );

      const keepConstraintName =
        constraints.find((item) => String(item.definition).includes("ON DELETE SET NULL"))
          ?.conname || null;

      for (const constraint of constraints) {
        if (constraint.conname === keepConstraintName) {
          continue;
        }

        await queryInterface.removeConstraint("receivables", constraint.conname, {
          transaction,
        });
      }

      if (!keepConstraintName) {
        await queryInterface.addConstraint("receivables", {
          fields: ["saleId"],
          type: "foreign key",
          name: "receivables_saleId_fkey_set_null",
          references: {
            table: "sales",
            field: "idSale",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          transaction,
        });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [constraints] = await queryInterface.sequelize.query(
        `
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'receivables'::regclass
            AND contype = 'f'
            AND conname LIKE 'receivables_saleId_fkey%';
        `,
        { transaction },
      );

      for (const constraint of constraints) {
        await queryInterface.removeConstraint("receivables", constraint.conname, {
          transaction,
        });
      }

      await queryInterface.addConstraint("receivables", {
        fields: ["saleId"],
        type: "foreign key",
        name: "receivables_saleId_fkey",
        references: {
          table: "sales",
          field: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        transaction,
      });

      await queryInterface.changeColumn(
        "receivables",
        "saleId",
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "sales",
            key: "idSale",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
