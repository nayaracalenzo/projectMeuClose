require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Payables, PayablePayments, PaymentTypes, Suppliers } = require("../models");
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

function normalizeLegacyPaymentTypeId(value) {
  const normalized = normalizeInteger(value);
  if (!normalized || normalized <= 0) return null;
  return normalized;
}

function deriveSettlementTarget(paymentTypeDesc) {
  const normalized = String(paymentTypeDesc || "")
    .trim()
    .toUpperCase();

  return normalized === "DINHEIRO" ? "CAIXA" : "BANCO";
}

function deriveStatus({ amount, paidAmount, dueDate }) {
  if (paidAmount >= amount && amount > 0) {
    return {
      status: "PAID",
      openAmount: 0,
    };
  }

  if (paidAmount > 0 && paidAmount < amount) {
    return {
      status: "PAID",
      openAmount: 0,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizedDueDate = new Date(dueDate);
  normalizedDueDate.setHours(0, 0, 0, 0);

  return {
    status: normalizedDueDate.getTime() < today.getTime() ? "OVERDUE" : "OPEN",
    openAmount: amount,
  };
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

function buildSupplierMap(rows) {
  return new Map(
    rows
      .map((row) => {
        const id = normalizeInteger(row.id);
        const preferredName = normalizeText(row.nomFan) || normalizeText(row.nom);
        return [id, preferredName];
      })
      .filter(([id, name]) => id && name),
  );
}

async function importPayables() {
  console.log("Iniciando leitura dos CSVs de contas a pagar...");

  const [payableRows, accountRows, supplierRows, paymentTypes, suppliers] = await Promise.all([
    readCsvRows("contaPag.csv"),
    readCsvRows("conta.csv"),
    readCsvRows("fornecedor.csv"),
    PaymentTypes.findAll({ attributes: ["idPaymentType", "desc"], raw: true }),
    Suppliers.findAll({ attributes: ["idSupplier"], raw: true }),
  ]);

  console.log(`Total encontrados em contaPag.csv: ${payableRows.length}`);

  const categoryMap = buildCategoryMap(accountRows);
  const supplierMap = buildSupplierMap(supplierRows);
  const paymentTypeMap = new Map(
    paymentTypes.map((item) => [Number(item.idPaymentType), item.desc]),
  );
  const validSupplierIds = new Set(suppliers.map((item) => Number(item.idSupplier)));

  const payablesToInsert = [];
  const paymentsToInsert = [];
  let skipped = 0;

  for (const row of payableRows) {
    const legacyId = normalizeInteger(row.id);

    try {
      if (!legacyId) {
        skipped += 1;
        continue;
      }

      const amount = normalizeLegacyCurrency(row.vlr);
      if (!amount || amount <= 0) {
        console.warn(`Ignorando contaPag legado ${legacyId}: valor invalido.`);
        skipped += 1;
        continue;
      }

      const paidAmount = normalizeLegacyCurrency(row.vlrPag) || 0;
      const createdAt =
        normalizeLegacyDateTime(row.dtEmi) ||
        normalizeLegacyDateTime(row.dtVen, { dateOnly: true }) ||
        new Date();
      const dueDate = normalizeLegacyDateTime(row.dtVen, { dateOnly: true }) || createdAt;
      const paidAt = normalizeLegacyDateTime(row.dtPag, { dateOnly: true }) || null;
      const plannedPaymentTypeId = normalizeLegacyPaymentTypeId(row.idTipDoc);
      const paymentTypeDesc = plannedPaymentTypeId
        ? paymentTypeMap.get(plannedPaymentTypeId) || null
        : null;

      const statusInfo = deriveStatus({
        amount,
        paidAmount,
        dueDate,
      });

      const categoryId = normalizeInteger(row.idCon);
      const supplierId = normalizeInteger(row.idFor);
      const safeSupplierId =
        supplierId && validSupplierIds.has(supplierId) ? supplierId : null;
      const category =
        categoryMap.get(categoryId) ||
        (categoryId ? `CONTA ${categoryId}` : "DIVERSOS");
      const beneficiary =
        supplierMap.get(safeSupplierId || supplierId) ||
        (supplierId ? `FORNECEDOR ${supplierId}` : "Fornecedor não informado");
      const description = normalizeText(row.his) || category;
      const referenceCode = normalizeText(row.numDoc);

      payablesToInsert.push({
        idPayable: legacyId,
        scope: "LOJA",
        description,
        category,
        beneficiary,
        supplierId: safeSupplierId,
        amount,
        openAmount: statusInfo.openAmount,
        dueDate,
        status: statusInfo.status,
        settlementTarget: deriveSettlementTarget(paymentTypeDesc),
        accountLabel: null,
        plannedPaymentTypeId:
          plannedPaymentTypeId && paymentTypeMap.has(plannedPaymentTypeId)
            ? plannedPaymentTypeId
            : null,
        createdAt,
        updatedAt: paidAt || createdAt,
      });

      if (paidAmount > 0) {
        if (!plannedPaymentTypeId || !paymentTypeMap.has(plannedPaymentTypeId)) {
          console.warn(
            `ContaPag legado ${legacyId} possui pagamento sem tipo valido. Pagamento nao sera importado.`,
          );
          continue;
        }

        if (!paidAt) {
          console.warn(
            `ContaPag legado ${legacyId} possui valor pago, mas sem data de pagamento. Pagamento nao sera importado.`,
          );
          continue;
        }

        paymentsToInsert.push({
          idPayablePayment: legacyId,
          payableId: legacyId,
          paymentTypeId: plannedPaymentTypeId,
          amount: Number(Math.min(paidAmount, amount).toFixed(2)),
          paidAt,
          referenceCode,
          createdAt: paidAt,
          updatedAt: paidAt,
        });
      }
    } catch (error) {
      console.error(
        `Erro ao processar contaPag legado ${legacyId || "sem-id"}: ${error.message}`,
      );
      skipped += 1;
    }
  }

  try {
    await Payables.sequelize.transaction(async (transaction) => {
      await Payables.bulkCreate(payablesToInsert, {
        validate: true,
        updateOnDuplicate: [
          "scope",
          "description",
          "category",
          "beneficiary",
          "supplierId",
          "amount",
          "openAmount",
          "dueDate",
          "status",
          "settlementTarget",
          "accountLabel",
          "plannedPaymentTypeId",
          "updatedAt",
        ],
        transaction,
      });

      await PayablePayments.bulkCreate(paymentsToInsert, {
        validate: true,
        updateOnDuplicate: ["paymentTypeId", "amount", "paidAt", "referenceCode", "updatedAt"],
        transaction,
      });
    });

    await Payables.sequelize.query(`
      SELECT setval(
        pg_get_serial_sequence('"payables"', 'idPayable'),
        COALESCE((SELECT MAX("idPayable") FROM "payables"), 1),
        true
      );
    `);

    await Payables.sequelize.query(`
      SELECT setval(
        pg_get_serial_sequence('"payable_payments"', 'idPayablePayment'),
        COALESCE((SELECT MAX("idPayablePayment") FROM "payable_payments"), 1),
        true
      );
    `);

    console.log("Importacao de contas a pagar finalizada.");
    console.log(`Contas processadas: ${payablesToInsert.length}`);
    console.log(`Pagamentos processados: ${paymentsToInsert.length}`);
    console.log(`Ignoradas: ${skipped}`);
  } catch (error) {
    console.error("Erro geral ao importar contas a pagar:", error.message);
    process.exitCode = 1;
  } finally {
    await Payables.sequelize.close();
  }
}

importPayables();
