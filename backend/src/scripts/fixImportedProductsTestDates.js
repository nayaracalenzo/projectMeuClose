require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Products } = require("../models");
const parseDate = require("../utils/parseDate");

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) ? normalized : null;
}

async function fixImportedProductsTestDates() {
  const filePath = path.join(__dirname, "produto.csv");
  const updates = [];

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({ separator: ";" }))
        .on("data", (row) => {
          const productId = normalizeInteger(row.id);
          const testDate = parseDate(row.dtPro);

          if (!productId || !testDate) {
            return;
          }

          updates.push({
            id: productId,
            testDate,
          });
        })
        .on("end", resolve)
        .on("error", reject);
    });

    let updatedCount = 0;

    for (const update of updates) {
      const [count] = await Products.update(
        { testDate: update.testDate },
        {
          where: { id: update.id },
        },
      );

      updatedCount += count;
    }

    console.log("Correcao de testDate finalizada.");
    console.log(`Datas corrigidas: ${updatedCount}`);
  } catch (error) {
    console.error("Erro ao corrigir testDate dos produtos importados:", error.message);
    process.exitCode = 1;
  } finally {
    await Products.sequelize.close();
  }
}

fixImportedProductsTestDates();
