require("dotenv").config();
const { CashEntries, FinancialCategories, PaymentTypes } = require("../models");
const { normalizeLegacyCurrency } = require("../utils/normalizeLegacyCurrency");
const { normalizeLegacyDateTime } = require("../utils/normalizeLegacyDateTime");
const { readLegacyCsvRows } = require("./legacyImportSource");

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

function normalizeLegacyPaymentTypeId(value) {
  const normalized = normalizeInteger(value);
  if (!normalized || normalized <= 0) return null;
  return normalized;
}

function buildCategoryMap(rows) {
  return new Map(
    rows
      .map((row) => [
        normalizeInteger(row.idFinancialCategory),
        normalizeText(row.description),
      ])
      .filter(([id, desc]) => id && desc),
  );
}

async function importCashEntries() {
  console.log("Iniciando leitura do CSV de caixa...");

  const [cashRows, accountRows, paymentTypes] = await Promise.all([
    readLegacyCsvRows("livroCaixa.csv"),
    FinancialCategories.findAll({
      attributes: ["idFinancialCategory", "description"],
      raw: true,
    }),
    PaymentTypes.findAll({ attributes: ["idPaymentType"], raw: true }),
  ]);

  console.log(`Total encontrados em livroCaixa.csv: ${cashRows.length}`);

  const categoryMap = buildCategoryMap(accountRows);
  const validPaymentTypeIds = new Set(
    paymentTypes.map((item) => Number(item.idPaymentType)),
  );

  const entriesToInsert = [];
  let skipped = 0;

  for (const row of cashRows) {
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
      const category = categoryMap.get(categoryId);

      if (!categoryId || !category) {
        console.warn(
          `Ignorando livroCaixa legado ${legacyId}: categoria financeira invalida ou ausente.`,
        );
        skipped += 1;
        continue;
      }

      const occurredAt = normalizeLegacyDateTime(row.dt) || new Date();
      const paymentTypeId = normalizeLegacyPaymentTypeId(row.idTipDoc);
      const referenceCode = normalizeText(row.num);
      const description = normalizeText(row.his) || category;

      entriesToInsert.push({
        idCashEntry: legacyId,
        scope: "LOJA",
        movementType,
        category,
        financialCategoryId: categoryId,
        description,
        amount,
        occurredAt,
        sourceType: "MANUAL",
        saleId: null,
        paymentReceiptId: null,
        payablePaymentId: null,
        paymentTypeId:
          paymentTypeId && validPaymentTypeIds.has(paymentTypeId) ? paymentTypeId : null,
        cashSessionId: null,
        referenceCode,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      });
    } catch (error) {
      console.error(
        `Erro ao processar livroCaixa legado ${legacyId || "sem-id"}: ${error.message}`,
      );
      skipped += 1;
    }
  }

  try {
    await CashEntries.bulkCreate(entriesToInsert, {
      validate: true,
      updateOnDuplicate: [
        "scope",
        "movementType",
        "category",
        "financialCategoryId",
        "description",
        "amount",
        "occurredAt",
        "sourceType",
        "paymentTypeId",
        "referenceCode",
        "updatedAt",
      ],
    });

    await CashEntries.sequelize.query(`
      SELECT setval(
        pg_get_serial_sequence('"cash_entries"', 'idCashEntry'),
        COALESCE((SELECT MAX("idCashEntry") FROM "cash_entries"), 1),
        true
      );
    `);

    console.log("Importacao de caixa finalizada.");
    console.log(`Movimentos processados: ${entriesToInsert.length}`);
    console.log(`Ignorados: ${skipped}`);
  } catch (error) {
    console.error("Erro geral ao importar caixa:", error.message);
    process.exitCode = 1;
  } finally {
    await CashEntries.sequelize.close();
  }
}

if (require.main === module) {
  importCashEntries();
}

module.exports = importCashEntries;
