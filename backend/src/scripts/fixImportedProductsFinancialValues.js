require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Products } = require("../models");
const { normalizeLegacyCurrency } = require("../utils/normalizeLegacyCurrency");

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) ? normalized : null;
}

async function fixImportedProductsFinancialValues() {
  const filePath = path.join(__dirname, "produto.csv");
  const updates = [];

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({ separator: ";" }))
        .on("data", (row) => {
          const productId = normalizeInteger(row.id);
          if (!productId) return;

          const finalValue = normalizeLegacyCurrency(row.pre) || 0;
          const dressmakerValue = normalizeLegacyCurrency(row.pgCos) ?? 0;
          const remainingValue = Number((finalValue - dressmakerValue).toFixed(2));

          updates.push({
            id: productId,
            finalValue,
            dressmakerValue,
            remainingValue,
          });
        })
        .on("end", resolve)
        .on("error", reject);
    });

    let updatedCount = 0;

    for (const update of updates) {
      const [count] = await Products.update(
        {
          finalValue: update.finalValue,
          dressmakerValue: update.dressmakerValue,
          remainingValue: update.remainingValue,
        },
        {
          where: { id: update.id },
        },
      );

      updatedCount += count;
    }

    console.log("Correcao de valores financeiros finalizada.");
    console.log(`Produtos atualizados: ${updatedCount}`);
  } catch (error) {
    console.error("Erro ao corrigir valores financeiros dos produtos importados:", error.message);
    process.exitCode = 1;
  } finally {
    await Products.sequelize.close();
  }
}

fixImportedProductsFinancialValues();
