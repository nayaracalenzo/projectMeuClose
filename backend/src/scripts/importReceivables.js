require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const {
  Customers,
  PaymentReceipts,
  PaymentTypes,
  ReceivableInstallments,
  Receivables,
  Suppliers,
  sequelize,
} = require("../models");
const { normalizeLegacyCurrency } = require("../utils/normalizeLegacyCurrency");
const { normalizeLegacyDateTime } = require("../utils/normalizeLegacyDateTime");
const { parseLegacyInstallmentInfo } = require("../utils/parseLegacyInstallmentInfo");

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

function buildGroupingKey(row) {
  return [
    normalizeInteger(row.idCli) || "",
    normalizeInteger(row.idCon) || "",
    normalizeLegacyPaymentTypeId(row.idTipDoc) || "",
    normalizeText(row.numDoc) || "",
    normalizeText(row.his) || "",
    normalizeText(row.dtEmi) || "",
    normalizeText(row.dtVen) || "",
    normalizeText(row.vlr) || "",
  ].join("|");
}

function normalizeCategoryDescriptor(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[ÃÁÀÂÄ]/g, "A")
    .replace(/[ÉÈÊË]/g, "E")
    .replace(/[ÍÌÎÏ]/g, "I")
    .replace(/[ÓÒÔÖÕ]/g, "O")
    .replace(/[ÚÙÛÜ]/g, "U")
    .replace(/Ç/g, "C");
}

function inferDebtorProfile(accountDesc) {
  const normalized = normalizeCategoryDescriptor(accountDesc);

  if (
    normalized.includes("CARTAO") ||
    normalized.includes("MASTER") ||
    normalized.includes("VISA") ||
    normalized.includes("OPERAD")
  ) {
    return {
      debtorType: "CARD_OPERATOR",
      operatorLabel: accountDesc || "Operadora",
    };
  }

  return {
    debtorType: "CUSTOMER",
    operatorLabel: null,
  };
}

function deriveStatus({ amount, paidAmount, dueDate }) {
  if (paidAmount >= amount && amount > 0) {
    return {
      receivableStatus: "PAID",
      installmentStatus: "PAID",
      openAmount: 0,
    };
  }

  if (paidAmount > 0 && paidAmount < amount) {
    return {
      receivableStatus: "PAID",
      installmentStatus: "PAID",
      openAmount: 0,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizedDueDate = new Date(dueDate);
  normalizedDueDate.setHours(0, 0, 0, 0);

  const overdue = normalizedDueDate.getTime() < today.getTime();

  return {
    receivableStatus: overdue ? "OVERDUE" : "OPEN",
    installmentStatus: overdue ? "OVERDUE" : "OPEN",
    openAmount: Number(amount.toFixed(2)),
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

function buildAccountMap(rows) {
  return new Map(
    rows
      .map((row) => [normalizeInteger(row.id), normalizeText(row.des)])
      .filter(([id, desc]) => id && desc),
  );
}

function groupReceivableRows(rows) {
  const groups = new Map();

  for (const row of rows) {
    const key = buildGroupingKey(row);
    const current = groups.get(key);

    if (current) {
      current.rows.push(row);
      continue;
    }

    groups.set(key, {
      key,
      baseRow: row,
      rows: [row],
    });
  }

  return [...groups.values()];
}

async function importReceivables() {
  console.log("Iniciando leitura dos CSVs de contas a receber...");

  const [receivableRows, accountRows, customers, paymentTypes, suppliers] = await Promise.all([
    readCsvRows("contaRec.csv"),
    readCsvRows("conta.csv"),
    Customers.findAll({ attributes: ["idCustomer"], raw: true }),
    PaymentTypes.findAll({ attributes: ["idPaymentType"], raw: true }),
    Suppliers.findAll({ attributes: ["idSupplier"], raw: true }),
  ]);

  console.log(`Total encontrados em contaRec.csv: ${receivableRows.length}`);

  const groups = groupReceivableRows(receivableRows);
  const accountMap = buildAccountMap(accountRows);
  const validCustomerIds = new Set(customers.map((item) => Number(item.idCustomer)));
  const validPaymentTypeIds = new Set(
    paymentTypes.map((item) => Number(item.idPaymentType)),
  );
  const validSupplierIds = new Set(suppliers.map((item) => Number(item.idSupplier)));

  const receivablesToInsert = [];
  const installmentsToInsert = [];
  const receiptsToInsert = [];
  let skipped = 0;

  for (const group of groups) {
    const baseRow = group.baseRow;
    const representativeId = normalizeInteger(baseRow.id);

    try {
      if (!representativeId) {
        skipped += 1;
        continue;
      }

      const amount = normalizeLegacyCurrency(baseRow.vlr);
      if (!amount || amount <= 0) {
        skipped += 1;
        continue;
      }

      const createdAt =
        normalizeLegacyDateTime(baseRow.dtEmi) ||
        normalizeLegacyDateTime(baseRow.dtVen, { dateOnly: true }) ||
        new Date();
      const dueDate =
        normalizeLegacyDateTime(baseRow.dtVen, { dateOnly: true }) || createdAt;
      const paymentTypeId = normalizeLegacyPaymentTypeId(baseRow.idTipDoc);
      const customerId = normalizeInteger(baseRow.idCli);
      const supplierId = normalizeInteger(baseRow.idPor);
      const accountDesc = accountMap.get(normalizeInteger(baseRow.idCon)) || "VENDA";
      const debtorProfile = inferDebtorProfile(accountDesc);
      const installmentInfo = parseLegacyInstallmentInfo(baseRow.numDoc, baseRow.his);
      const paidAmount = Number(
        group.rows
          .reduce((acc, row) => acc + Number(normalizeLegacyCurrency(row.vlrRec) || 0), 0)
          .toFixed(2),
      );
      const statusInfo = deriveStatus({ amount, paidAmount, dueDate });
      const safeCustomerId =
        debtorProfile.debtorType === "CUSTOMER" &&
        customerId &&
        validCustomerIds.has(customerId)
          ? customerId
          : null;
      const safeSupplierId =
        supplierId && validSupplierIds.has(supplierId) ? supplierId : null;

      receivablesToInsert.push({
        idReceivable: representativeId,
        saleId: null,
        customerId: safeCustomerId,
        supplierId: safeSupplierId,
        debtorType: debtorProfile.debtorType,
        operatorLabel: debtorProfile.operatorLabel,
        originalAmount: amount,
        openAmount: statusInfo.openAmount,
        status: statusInfo.receivableStatus,
        createdAt,
        updatedAt: createdAt,
      });

      installmentsToInsert.push({
        idReceivableInstallment: representativeId,
        receivableId: representativeId,
        paymentTypeId:
          paymentTypeId && validPaymentTypeIds.has(paymentTypeId) ? paymentTypeId : null,
        installmentNumber: installmentInfo.installmentNumber,
        totalInstallments: installmentInfo.totalInstallments,
        dueDate,
        amount,
        paidAmount,
        status: statusInfo.installmentStatus,
        createdAt,
        updatedAt: createdAt,
      });

      for (const row of group.rows) {
        const receiptId = normalizeInteger(row.id);
        const receiptAmount = normalizeLegacyCurrency(row.vlrRec) || 0;
        const receiptPaidAt = normalizeLegacyDateTime(row.dtRec, { dateOnly: true }) || null;
        const receiptPaymentTypeId = normalizeLegacyPaymentTypeId(row.idTipDoc);

        if (!receiptId || receiptAmount <= 0 || !receiptPaidAt) {
          continue;
        }

        if (!receiptPaymentTypeId || !validPaymentTypeIds.has(receiptPaymentTypeId)) {
          console.warn(
            `ContaRec legado ${receiptId} possui recebimento sem tipo de pagamento valido. Recebimento ignorado.`,
          );
          continue;
        }

        receiptsToInsert.push({
          idPaymentReceipt: receiptId,
          saleId: null,
          receivableInstallmentId: representativeId,
          paymentTypeId: receiptPaymentTypeId,
          receiptType: "INSTALLMENT",
          amount: receiptAmount,
          paidAt: receiptPaidAt,
          referenceCode: normalizeText(row.numDoc),
          createdAt: receiptPaidAt,
          updatedAt: receiptPaidAt,
        });
      }
    } catch (error) {
      console.error(
        `Erro ao processar contaRec legado ${representativeId || "sem-id"}: ${error.message}`,
      );
      skipped += 1;
    }
  }

  try {
    await sequelize.transaction(async (transaction) => {
      await Receivables.bulkCreate(receivablesToInsert, {
        validate: true,
        updateOnDuplicate: [
          "saleId",
          "customerId",
          "supplierId",
          "debtorType",
          "operatorLabel",
          "originalAmount",
          "openAmount",
          "status",
          "updatedAt",
        ],
        transaction,
      });

      await ReceivableInstallments.bulkCreate(installmentsToInsert, {
        validate: true,
        updateOnDuplicate: [
          "receivableId",
          "paymentTypeId",
          "installmentNumber",
          "totalInstallments",
          "dueDate",
          "amount",
          "paidAmount",
          "status",
          "updatedAt",
        ],
        transaction,
      });

      await PaymentReceipts.bulkCreate(receiptsToInsert, {
        validate: true,
        updateOnDuplicate: [
          "saleId",
          "receivableInstallmentId",
          "paymentTypeId",
          "receiptType",
          "amount",
          "paidAt",
          "referenceCode",
          "updatedAt",
        ],
        transaction,
      });
    });

    await Receivables.sequelize.query(`
      SELECT setval(
        pg_get_serial_sequence('"receivables"', 'idReceivable'),
        COALESCE((SELECT MAX("idReceivable") FROM "receivables"), 1),
        true
      );
    `);

    await Receivables.sequelize.query(`
      SELECT setval(
        pg_get_serial_sequence('"receivable_installments"', 'idReceivableInstallment'),
        COALESCE((SELECT MAX("idReceivableInstallment") FROM "receivable_installments"), 1),
        true
      );
    `);

    await Receivables.sequelize.query(`
      SELECT setval(
        pg_get_serial_sequence('"payment_receipts"', 'idPaymentReceipt'),
        COALESCE((SELECT MAX("idPaymentReceipt") FROM "payment_receipts"), 1),
        true
      );
    `);

    console.log("Importacao de contas a receber finalizada.");
    console.log(`Titulos processados: ${receivablesToInsert.length}`);
    console.log(`Parcelas processadas: ${installmentsToInsert.length}`);
    console.log(`Recebimentos processados: ${receiptsToInsert.length}`);
    console.log(`Ignorados: ${skipped}`);
  } catch (error) {
    console.error("Erro geral ao importar contas a receber:", error.message);
    process.exitCode = 1;
  } finally {
    await Receivables.sequelize.close();
  }
}

importReceivables();
