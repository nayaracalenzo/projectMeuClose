require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { BankEntries } = require("../models");
const { normalizeLegacyCurrency } = require("../utils/normalizeLegacyCurrency");
const { normalizeLegacyDateTime } = require("../utils/normalizeLegacyDateTime");

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

function buildCategoryMap(rows) {
  return new Map(
    rows
      .map((row) => [normalizeInteger(row.id), normalizeText(row.des)])
      .filter(([id, desc]) => id && desc),
  );
}

async function importBankEntries() {
  console.log("Iniciando leitura do CSV de banco...");

  const [bankRows, accountRows] = await Promise.all([
    readCsvRows("lancamentoBancos.csv"),
    readCsvRows("conta.csv"),
  ]);

  console.log(`Total encontrados em lancamentoBancos.csv: ${bankRows.length}`);

  const categoryMap = buildCategoryMap(accountRows);
  const entriesToInsert = [];
  let skipped = 0;

  for (const row of bankRows) {
    const legacyId = normalizeInteger(row.id);

    try {
      if (!legacyId) {
        skipped += 1;
        continue;
      }

      const amountIn = normalizeLegacyCurrency(row.ent) || 0;
      const amountOut = normalizeLegacyCurrency(row.sai) || 0;

      if (amountIn <= 0 && amountOut <= 0) {
        skipped += 1;
        continue;
      }

      const movementType = amountIn > 0 ? "IN" : "OUT";
      const amount = Number((amountIn > 0 ? amountIn : amountOut).toFixed(2));
      const categoryId = normalizeInteger(row.idCon);
      const category =
        categoryMap.get(categoryId) ||
        (categoryId ? `CONTA ${categoryId}` : "DIVERSOS");
      const occurredAt = normalizeLegacyDateTime(row.dt) || new Date();
      const referenceCode = normalizeText(row.num);
      const description = normalizeText(row.his) || category;

      entriesToInsert.push({
        idBankEntry: legacyId,
        scope: "LOJA",
        movementType,
        category,
        description,
        accountLabel: "Banco da Loja",
        amount,
        occurredAt,
        sourceType: "MANUAL",
        saleId: null,
        paymentReceiptId: null,
        payablePaymentId: null,
        paymentTypeId: null,
        referenceCode,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      });
    } catch (error) {
      console.error(
        `Erro ao processar lancamentoBancos legado ${legacyId || "sem-id"}: ${error.message}`,
      );
      skipped += 1;
    }
  }

  try {
    await BankEntries.bulkCreate(entriesToInsert, {
      validate: true,
      updateOnDuplicate: [
        "scope",
        "movementType",
        "category",
        "description",
        "accountLabel",
        "amount",
        "occurredAt",
        "sourceType",
        "referenceCode",
        "updatedAt",
      ],
    });

    await BankEntries.sequelize.query(`
      SELECT setval(
        pg_get_serial_sequence('"bank_entries"', 'idBankEntry'),
        COALESCE((SELECT MAX("idBankEntry") FROM "bank_entries"), 1),
        true
      );
    `);

    console.log("Importacao de banco finalizada.");
    console.log(`Movimentos processados: ${entriesToInsert.length}`);
    console.log(`Ignorados: ${skipped}`);
  } catch (error) {
    console.error("Erro geral ao importar banco:", error.message);
    process.exitCode = 1;
  } finally {
    await BankEntries.sequelize.close();
  }
}

importBankEntries();
