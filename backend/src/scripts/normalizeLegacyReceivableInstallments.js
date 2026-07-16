require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { ReceivableInstallments, sequelize } = require("../models");
const { parseLegacyInstallmentInfo } = require("../utils/parseLegacyInstallmentInfo");

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) ? normalized : null;
}

async function readCsvRows(fileName) {
  const filePath = path.join(__dirname, fileName);
  const rows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ separator: ";" }))
      .on("data", (row) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  return rows;
}

async function normalizeLegacyReceivableInstallments() {
  try {
    console.log("Normalizando parcelas legadas de contaRec.csv...");

    const rows = await readCsvRows("contaRec.csv");
    let updated = 0;
    let unchanged = 0;
    let skipped = 0;

    await sequelize.transaction(async (transaction) => {
      for (const row of rows) {
        const legacyId = normalizeInteger(row.id);
        if (!legacyId) {
          skipped += 1;
          continue;
        }

        const installment = await ReceivableInstallments.findByPk(legacyId, {
          transaction,
        });

        if (!installment) {
          skipped += 1;
          continue;
        }

        const installmentInfo = parseLegacyInstallmentInfo(row.numDoc, row.his);
        const nextInstallmentNumber = installmentInfo.installmentNumber;
        const nextTotalInstallments = installmentInfo.totalInstallments;

        if (
          Number(installment.installmentNumber) === nextInstallmentNumber &&
          Number(installment.totalInstallments) === nextTotalInstallments
        ) {
          unchanged += 1;
          continue;
        }

        installment.installmentNumber = nextInstallmentNumber;
        installment.totalInstallments = nextTotalInstallments;
        await installment.save({ transaction });
        updated += 1;
      }
    });

    console.log("Normalizacao de parcelas legadas finalizada.");
    console.log(`Atualizadas: ${updated}`);
    console.log(`Sem mudanca: ${unchanged}`);
    console.log(`Ignoradas: ${skipped}`);
  } catch (error) {
    console.error("Erro ao normalizar parcelas legadas:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

normalizeLegacyReceivableInstallments();
