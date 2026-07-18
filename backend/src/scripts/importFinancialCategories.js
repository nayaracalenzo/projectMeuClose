require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { FinancialCategories } = require("../models");

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) ? normalized : null;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

async function importFinancialCategories() {
  const rows = [];
  const filePath = path.join(__dirname, "conta.csv");

  console.log("Iniciando leitura do CSV de categorias financeiras...");

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ";" }))
    .on("data", (data) => {
      rows.push(data);
    })
    .on("end", async () => {
      const categoriesToInsert = [];
      let skipped = 0;

      for (const row of rows) {
        const id = normalizeInteger(row.id);
        const description = normalizeText(row.des);

        if (!id || !description) {
          skipped += 1;
          continue;
        }

        categoriesToInsert.push({
          idFinancialCategory: id,
          description,
        });
      }

      try {
        await FinancialCategories.bulkCreate(categoriesToInsert, {
          validate: true,
          updateOnDuplicate: ["description", "updatedAt"],
        });

        console.log("Importacao de categorias financeiras finalizada.");
        console.log(`Processadas: ${categoriesToInsert.length}`);
        console.log(`Ignoradas: ${skipped}`);
      } catch (error) {
        console.error("Erro geral ao importar categorias financeiras:", error.message);
      }

      await FinancialCategories.sequelize.close();
      process.exit();
    })
    .on("error", async (error) => {
      console.error("Erro ao ler conta.csv:", error.message);
      await FinancialCategories.sequelize.close();
      process.exit(1);
    });
}

if (require.main === module) {
  importFinancialCategories();
}

module.exports = importFinancialCategories;
