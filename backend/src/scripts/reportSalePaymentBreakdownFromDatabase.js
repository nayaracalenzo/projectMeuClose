require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

function parseIdList(rawValue) {
  if (!rawValue) return [];

  return [
    ...new Set(
      String(rawValue)
        .split(",")
        .map((value) => Number(String(value).trim()))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];
}

function readArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    saleIds: [],
    customerId: null,
    onlyMismatch: false,
  };

  args.forEach((arg) => {
    if (arg === "--only-mismatch") {
      parsed.onlyMismatch = true;
      return;
    }

    if (arg.startsWith("--sale-ids=")) {
      parsed.saleIds = parseIdList(arg.slice("--sale-ids=".length));
      return;
    }

    if (arg.startsWith("--customer-id=")) {
      const value = Number(arg.slice("--customer-id=".length));
      parsed.customerId = Number.isInteger(value) && value > 0 ? value : null;
    }
  });

  return parsed;
}

function roundCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function listSalesBreakdown({ saleIds, customerId }) {
  const filters = [];
  const replacements = {};

  if (saleIds.length) {
    filters.push(`s."idSale" IN (:saleIds)`);
    replacements.saleIds = saleIds;
  }

  if (customerId) {
    filters.push(`s."customerId" = :customerId`);
    replacements.customerId = customerId;
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  return sequelize.query(
    `
      WITH immediate_receipts AS (
        SELECT
          pr."saleId",
          COALESCE(SUM(pr.amount), 0) AS "immediateAmount",
          COUNT(*) FILTER (WHERE pr."receiptType" = 'ENTRY') AS "entryReceiptCount",
          COUNT(*) FILTER (WHERE pr."receiptType" = 'SALE_FULL') AS "saleFullReceiptCount"
        FROM payment_receipts pr
        WHERE pr."saleId" IS NOT NULL
          AND pr."receivableInstallmentId" IS NULL
          AND pr."receiptType" IN ('ENTRY', 'SALE_FULL')
        GROUP BY pr."saleId"
      ),
      sale_receivables AS (
        SELECT
          r."saleId",
          COALESCE(SUM(ri.amount), 0) AS "installmentAmount",
          COUNT(ri."idReceivableInstallment") AS "installmentCount"
        FROM receivables r
        JOIN receivable_installments ri
          ON ri."receivableId" = r."idReceivable"
        WHERE r."saleId" IS NOT NULL
        GROUP BY r."saleId"
      ),
      orphan_same_day_receipts AS (
        SELECT
          s."idSale" AS "saleId",
          COALESCE(SUM(pr.amount), 0) AS "sameDayCustomerReceiptAmount",
          COUNT(pr."idPaymentReceipt") AS "sameDayCustomerReceiptCount"
        FROM sales s
        JOIN payment_receipts pr
          ON pr."saleId" IS NULL
         AND pr."receivableInstallmentId" IS NULL
         AND pr."receiptType" IN ('ENTRY', 'SALE_FULL')
         AND DATE(pr."paidAt") = DATE(s."createdAt")
        JOIN customers c
          ON c."idCustomer" = s."customerId"
        WHERE EXISTS (
          SELECT 1
          FROM receivables r2
          JOIN receivable_installments ri2
            ON ri2."receivableId" = r2."idReceivable"
          WHERE r2."customerId" = s."customerId"
            AND DATE(ri2."createdAt") = DATE(pr."createdAt")
        )
        GROUP BY s."idSale"
      )
      SELECT
        s."idSale" AS "saleId",
        s."customerId",
        COALESCE(c."fullName", c."companyName", 'SEM CLIENTE') AS "customerName",
        s.status,
        DATE(s."createdAt") AS "saleDate",
        ROUND(COALESCE(s."finalAmount", 0)::numeric, 2) AS "totalAmount",
        ROUND(COALESCE(ir."immediateAmount", 0)::numeric, 2) AS "immediateAmount",
        ROUND(COALESCE(sr."installmentAmount", 0)::numeric, 2) AS "installmentAmount",
        ROUND(
          (COALESCE(s."finalAmount", 0) - COALESCE(ir."immediateAmount", 0) - COALESCE(sr."installmentAmount", 0))::numeric,
          2
        ) AS "differenceAmount",
        COALESCE(ir."entryReceiptCount", 0) AS "entryReceiptCount",
        COALESCE(ir."saleFullReceiptCount", 0) AS "saleFullReceiptCount",
        COALESCE(sr."installmentCount", 0) AS "installmentCount",
        ROUND(COALESCE(osdr."sameDayCustomerReceiptAmount", 0)::numeric, 2) AS "sameDayCustomerReceiptAmount",
        COALESCE(osdr."sameDayCustomerReceiptCount", 0) AS "sameDayCustomerReceiptCount"
      FROM sales s
      LEFT JOIN customers c
        ON c."idCustomer" = s."customerId"
      LEFT JOIN immediate_receipts ir
        ON ir."saleId" = s."idSale"
      LEFT JOIN sale_receivables sr
        ON sr."saleId" = s."idSale"
      LEFT JOIN orphan_same_day_receipts osdr
        ON osdr."saleId" = s."idSale"
      ${whereClause}
      ORDER BY s."idSale" DESC
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );
}

async function main() {
  const args = readArgs();

  try {
    const rows = await listSalesBreakdown(args);
    const normalizedRows = rows.map((row) => ({
      saleId: Number(row.saleId),
      customerId: Number(row.customerId || 0) || null,
      customerName: String(row.customerName || "SEM CLIENTE"),
      status: String(row.status || ""),
      saleDate: String(row.saleDate || ""),
      totalAmount: roundCurrency(row.totalAmount),
      immediateAmount: roundCurrency(row.immediateAmount),
      installmentAmount: roundCurrency(row.installmentAmount),
      differenceAmount: roundCurrency(row.differenceAmount),
      entryReceiptCount: Number(row.entryReceiptCount || 0),
      saleFullReceiptCount: Number(row.saleFullReceiptCount || 0),
      installmentCount: Number(row.installmentCount || 0),
      sameDayCustomerReceiptAmount: roundCurrency(row.sameDayCustomerReceiptAmount),
      sameDayCustomerReceiptCount: Number(row.sameDayCustomerReceiptCount || 0),
    }));

    const filteredRows = args.onlyMismatch
      ? normalizedRows.filter((row) => Math.abs(row.differenceAmount) >= 0.01)
      : normalizedRows;

    console.log(`Vendas analisadas: ${normalizedRows.length}`);
    console.log(`Vendas exibidas: ${filteredRows.length}`);

    if (!filteredRows.length) {
      console.log("Nenhuma venda encontrada para os filtros informados.");
      return;
    }

    console.table(
      filteredRows.map((row) => ({
        saleId: row.saleId,
        customerId: row.customerId,
        customerName: row.customerName,
        saleDate: row.saleDate,
        total: row.totalAmount,
        vista: row.immediateAmount,
        prazo: row.installmentAmount,
        diferenca: row.differenceAmount,
        entryReceipts: row.entryReceiptCount,
        saleFullReceipts: row.saleFullReceiptCount,
        parcelas: row.installmentCount,
        sameDayReceipt: row.sameDayCustomerReceiptAmount,
        sameDayCount: row.sameDayCustomerReceiptCount,
      })),
    );
  } catch (error) {
    console.error("Erro ao gerar relatorio de composicao de vendas:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
