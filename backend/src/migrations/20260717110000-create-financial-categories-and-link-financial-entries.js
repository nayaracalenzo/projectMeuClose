const fs = require("fs");
const path = require("path");

function parseContaCsv() {
  const filePath = path.join(__dirname, "..", "scripts", "conta.csv");
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .slice(1)
    .map((line) => {
      const match = /^"?(?<id>\d+)"?;"?(?<description>.*)"?$/.exec(line);

      if (!match?.groups?.id || !match?.groups?.description) {
        return null;
      }

      const id = Number(match.groups.id);
      const description = String(match.groups.description || "")
        .trim()
        .replace(/^"+|"+$/g, "");

      if (!Number.isInteger(id) || id <= 0 || !description) {
        return null;
      }

      return {
        idFinancialCategory: id,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    })
    .filter(Boolean);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("financial_categories", {
      idFinancialCategory: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.bulkInsert("financial_categories", parseContaCsv());

    await queryInterface.addColumn("cash_entries", "financialCategoryId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "financial_categories",
        key: "idFinancialCategory",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("bank_entries", "financialCategoryId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "financial_categories",
        key: "idFinancialCategory",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("cash_entries", "transferKey", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addColumn("bank_entries", "transferKey", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addColumn("cash_entries", "reversalOfCashEntryId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "cash_entries",
        key: "idCashEntry",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("bank_entries", "reversalOfBankEntryId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "bank_entries",
        key: "idBankEntry",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(`
      UPDATE "cash_entries" AS ce
      SET "financialCategoryId" = fc."idFinancialCategory"
      FROM "financial_categories" AS fc
      WHERE ce."financialCategoryId" IS NULL
        AND UPPER(TRIM(COALESCE(ce."category", ''))) = UPPER(TRIM(fc."description"));
    `);

    await queryInterface.sequelize.query(`
      UPDATE "bank_entries" AS be
      SET "financialCategoryId" = fc."idFinancialCategory"
      FROM "financial_categories" AS fc
      WHERE be."financialCategoryId" IS NULL
        AND UPPER(TRIM(COALESCE(be."category", ''))) = UPPER(TRIM(fc."description"));
    `);

    await queryInterface.sequelize.query(`
      UPDATE "cash_entries"
      SET "financialCategoryId" = CAST(regexp_replace(TRIM("category"), '^CONTA\\s+', '') AS INTEGER)
      WHERE "financialCategoryId" IS NULL
        AND TRIM(COALESCE("category", '')) ~* '^CONTA\\s+[0-9]+$';
    `);

    await queryInterface.sequelize.query(`
      UPDATE "bank_entries"
      SET "financialCategoryId" = CAST(regexp_replace(TRIM("category"), '^CONTA\\s+', '') AS INTEGER)
      WHERE "financialCategoryId" IS NULL
        AND TRIM(COALESCE("category", '')) ~* '^CONTA\\s+[0-9]+$';
    `);

    await queryInterface.sequelize.query(`
      UPDATE "cash_entries"
      SET "financialCategoryId" = 3
      WHERE "financialCategoryId" IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE "bank_entries"
      SET "financialCategoryId" = 3
      WHERE "financialCategoryId" IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("bank_entries", "reversalOfBankEntryId");
    await queryInterface.removeColumn("cash_entries", "reversalOfCashEntryId");
    await queryInterface.removeColumn("bank_entries", "transferKey");
    await queryInterface.removeColumn("cash_entries", "transferKey");
    await queryInterface.removeColumn("bank_entries", "financialCategoryId");
    await queryInterface.removeColumn("cash_entries", "financialCategoryId");
    await queryInterface.dropTable("financial_categories");
  },
};
