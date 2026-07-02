require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Customers, PaymentTypes, Sales, Users } = require("../models");
const parseDate = require("../utils/parseDate");

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) ? normalized : null;
}

function normalizeDecimal(value) {
  if (value === undefined || value === null || value === "") return null;

  const normalizedText = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const normalized = Number(normalizedText);
  if (!Number.isFinite(normalized)) return null;

  return Number(normalized.toFixed(2));
}

function roundCurrency(value) {
  return Number(Number(value).toFixed(2));
}

function resolveMainPaymentTypeId(row, validPaymentTypeIds) {
  const immediateAmount = normalizeDecimal(row.vlrVis) || 0;
  const futureAmount = normalizeDecimal(row.vlrPra) || 0;
  const immediatePaymentTypeId = normalizeInteger(row.idTipDocVis);
  const futurePaymentTypeId = normalizeInteger(row.idTipDocPra);

  if (futureAmount > 0 && futurePaymentTypeId && validPaymentTypeIds.has(futurePaymentTypeId)) {
    return futurePaymentTypeId;
  }

  if (
    immediateAmount > 0 &&
    immediatePaymentTypeId &&
    validPaymentTypeIds.has(immediatePaymentTypeId)
  ) {
    return immediatePaymentTypeId;
  }

  if (futurePaymentTypeId && validPaymentTypeIds.has(futurePaymentTypeId)) {
    return futurePaymentTypeId;
  }

  if (immediatePaymentTypeId && validPaymentTypeIds.has(immediatePaymentTypeId)) {
    return immediatePaymentTypeId;
  }

  return null;
}

async function importSales() {
  const rows = [];
  const filePath = path.join(__dirname, "venda.csv");

  console.log("Iniciando leitura do CSV de vendas...");

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ";" }))
    .on("data", (data) => {
      rows.push(data);
    })
    .on("end", async () => {
      console.log(`Total encontrados no CSV: ${rows.length}`);

      const [customers, users, paymentTypes] = await Promise.all([
        Customers.findAll({ attributes: ["idCustomer"], raw: true }),
        Users.findAll({ attributes: ["idUser"], raw: true }),
        PaymentTypes.findAll({ attributes: ["idPaymentType"], raw: true }),
      ]);

      const validCustomerIds = new Set(customers.map((item) => Number(item.idCustomer)));
      const validUserIds = new Set(users.map((item) => Number(item.idUser)));
      const validPaymentTypeIds = new Set(
        paymentTypes.map((item) => Number(item.idPaymentType)),
      );

      const salesToInsert = [];
      let skipped = 0;

      for (const row of rows) {
        const legacyId = normalizeInteger(row.id);

        try {
          if (!legacyId) {
            skipped += 1;
            continue;
          }

          const customerId = normalizeInteger(row.idCli);
          if (!customerId || !validCustomerIds.has(customerId)) {
            console.warn(
              `Ignorando venda legado ${legacyId}: cliente ${row.idCli || "sem-id"} invalido.`,
            );
            skipped += 1;
            continue;
          }

          const userId = normalizeInteger(row.idUsu);
          const resolvedUserId = userId && validUserIds.has(userId) ? userId : null;
          const createdAt = parseDate(row.dt) || new Date();

          const totalAmountFromLegacy = normalizeDecimal(row.totVen);
          const immediateAmount = normalizeDecimal(row.vlrVis) || 0;
          const futureAmount = normalizeDecimal(row.vlrPra) || 0;
          const derivedFinalAmount = roundCurrency(immediateAmount + futureAmount);
          const finalAmount =
            derivedFinalAmount > 0
              ? derivedFinalAmount
              : roundCurrency(totalAmountFromLegacy || 0);
          const totalAmount =
            totalAmountFromLegacy !== null
              ? roundCurrency(totalAmountFromLegacy)
              : finalAmount;

          const hasDiscount = totalAmount > 0 && finalAmount < totalAmount;
          const discountPercent = hasDiscount
            ? roundCurrency(((totalAmount - finalAmount) / totalAmount) * 100)
            : null;

          salesToInsert.push({
            idSale: legacyId,
            customerId,
            userId: resolvedUserId,
            discountType: hasDiscount ? "PERCENTAGE" : null,
            discountValue: discountPercent,
            totalAmount,
            finalAmount,
            status: "COMPLETED",
            dueDate: null,
            paymentTypeId: resolveMainPaymentTypeId(row, validPaymentTypeIds),
            installmentCount: 1,
            createdAt,
            updatedAt: createdAt,
          });
        } catch (error) {
          console.error(
            `Erro ao processar venda legado ${legacyId || "sem-id"}:`,
            error.message,
          );
          skipped += 1;
        }
      }

      try {
        console.log("Inserindo vendas no banco...");

        await Sales.bulkCreate(salesToInsert, {
          validate: true,
          ignoreDuplicates: true,
        });

        await Sales.sequelize.query(`
          SELECT setval(
            pg_get_serial_sequence('"sales"', 'idSale'),
            COALESCE((SELECT MAX("idSale") FROM "sales"), 1),
            true
          );
        `);

        console.log("Importacao de vendas finalizada.");
        console.log(`Inseridas: ${salesToInsert.length}`);
        console.log(`Ignoradas: ${skipped}`);
      } catch (error) {
        console.error("Erro geral ao inserir vendas:", error.message);
      }

      await Sales.sequelize.close();
      process.exit();
    })
    .on("error", async (error) => {
      console.error("Erro ao ler o arquivo de vendas:", error.message);
      await Sales.sequelize.close();
      process.exit(1);
    });
}

importSales();
