require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

function parseInteger(value) {
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function normalizeDateArg(value, fieldName) {
  if (!value) return null;

  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${fieldName} deve estar no formato YYYY-MM-DD.`);
  }

  return normalized;
}

function readArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    apply: false,
    customerId: null,
    dueDateFrom: null,
    dueDateTo: null,
    limit: null,
    receivableIds: [],
  };

  for (const arg of args) {
    if (arg === "--apply") {
      parsed.apply = true;
      continue;
    }

    if (arg.startsWith("--customer-id=")) {
      parsed.customerId = parseInteger(arg.slice("--customer-id=".length));
      continue;
    }

    if (arg.startsWith("--due-date-from=")) {
      parsed.dueDateFrom = normalizeDateArg(
        arg.slice("--due-date-from=".length),
        "due-date-from",
      );
      continue;
    }

    if (arg.startsWith("--due-date-to=")) {
      parsed.dueDateTo = normalizeDateArg(
        arg.slice("--due-date-to=".length),
        "due-date-to",
      );
      continue;
    }

    if (arg.startsWith("--limit=")) {
      parsed.limit = parseInteger(arg.slice("--limit=".length));
      continue;
    }

    if (arg.startsWith("--receivable-ids=")) {
      parsed.receivableIds = [
        ...new Set(
          arg
            .slice("--receivable-ids=".length)
            .split(",")
            .map((value) => parseInteger(value))
            .filter(Boolean),
        ),
      ];
    }
  }

  if (parsed.dueDateFrom && parsed.dueDateTo && parsed.dueDateFrom > parsed.dueDateTo) {
    throw new Error("due-date-from nao pode ser maior que due-date-to.");
  }

  return parsed;
}

async function findDuplicateCandidates(filters) {
  const replacements = {
    limit: filters.limit,
  };

  const whereClauses = ['r."saleId" IS NULL', 'r."customerId" IS NOT NULL'];

  if (filters.customerId) {
    replacements.customerId = filters.customerId;
    whereClauses.push('r."customerId" = :customerId');
  }

  if (filters.dueDateFrom) {
    replacements.dueDateFrom = filters.dueDateFrom;
    whereClauses.push('ri."dueDate"::date >= :dueDateFrom::date');
  }

  if (filters.dueDateTo) {
    replacements.dueDateTo = filters.dueDateTo;
    whereClauses.push('ri."dueDate"::date <= :dueDateTo::date');
  }

  if (filters.receivableIds.length) {
    replacements.receivableIds = filters.receivableIds;
    whereClauses.push('r."idReceivable" IN (:receivableIds)');
  }

  const rows = await sequelize.query(
    `
      WITH legacy_rows AS (
        SELECT
          r."idReceivable" AS "receivableId",
          r."customerId" AS "customerId",
          c."fullName" AS "customerName",
          r.status AS "receivableStatus",
          r."openAmount" AS "receivableOpenAmount",
          r."createdAt" AS "createdAt",
          ri."idReceivableInstallment" AS "installmentId",
          ri."paymentTypeId" AS "paymentTypeId",
          pt."desc" AS "paymentTypeName",
          ri."installmentNumber" AS "installmentNumber",
          ri."totalInstallments" AS "totalInstallments",
          ri."dueDate"::date AS "dueDate",
          ri.amount AS "amount",
          ri."paidAmount" AS "paidAmount",
          ri.status AS "installmentStatus",
          COALESCE(pr."receiptCount", 0) AS "receiptCount",
          COALESCE(pr."receiptAmount", 0) AS "receiptAmount",
          pr."lastPaidAt" AS "lastPaidAt",
          CASE
            WHEN COALESCE(pr."receiptCount", 0) > 0 THEN 'SETTLED'
            WHEN COALESCE(ri."paidAmount", 0) > 0 THEN 'SETTLED'
            WHEN r.status = 'PAID' THEN 'SETTLED'
            WHEN COALESCE(r."openAmount", 0) = 0 THEN 'SETTLED'
            ELSE 'OPEN'
          END AS "settlementKind"
        FROM receivables r
        JOIN receivable_installments ri
          ON ri."receivableId" = r."idReceivable"
        LEFT JOIN customers c
          ON c."idCustomer" = r."customerId"
        LEFT JOIN payment_types pt
          ON pt."idPaymentType" = ri."paymentTypeId"
        LEFT JOIN (
          SELECT
            pr."receivableInstallmentId" AS "installmentId",
            COUNT(*)::int AS "receiptCount",
            SUM(pr.amount) AS "receiptAmount",
            MAX(pr."paidAt") AS "lastPaidAt"
          FROM payment_receipts pr
          GROUP BY pr."receivableInstallmentId"
        ) pr
          ON pr."installmentId" = ri."idReceivableInstallment"
        WHERE ${whereClauses.join("\n          AND ")}
      ),
      duplicate_groups AS (
        SELECT
          lr."customerId",
          lr."dueDate",
          COALESCE(lr."paymentTypeId", 0) AS "paymentTypeId",
          lr.amount,
          lr."installmentNumber",
          lr."totalInstallments",
          COUNT(*)::int AS "rowCount",
          COUNT(*) FILTER (WHERE lr."settlementKind" = 'SETTLED')::int AS "settledCount",
          COUNT(*) FILTER (WHERE lr."settlementKind" = 'OPEN')::int AS "openCount"
        FROM legacy_rows lr
        GROUP BY
          lr."customerId",
          lr."dueDate",
          COALESCE(lr."paymentTypeId", 0),
          lr.amount,
          lr."installmentNumber",
          lr."totalInstallments"
        HAVING COUNT(*) > 1
           AND COUNT(*) FILTER (WHERE lr."settlementKind" = 'SETTLED') > 0
           AND COUNT(*) FILTER (WHERE lr."settlementKind" = 'OPEN') > 0
      ),
      ranked_rows AS (
        SELECT
          lr.*,
          dg."rowCount",
          dg."settledCount",
          dg."openCount",
          ROW_NUMBER() OVER (
            PARTITION BY
              lr."customerId",
              lr."dueDate",
              COALESCE(lr."paymentTypeId", 0),
              lr.amount,
              lr."installmentNumber",
              lr."totalInstallments",
              lr."settlementKind"
            ORDER BY
              CASE WHEN lr."receiptCount" > 0 THEN 0 ELSE 1 END,
              COALESCE(lr."paidAmount", 0) DESC,
              COALESCE(lr."receivableOpenAmount", 0) ASC,
              lr."createdAt" ASC,
              lr."receivableId" ASC
          ) AS "groupRank"
        FROM legacy_rows lr
        JOIN duplicate_groups dg
          ON dg."customerId" = lr."customerId"
         AND dg."dueDate" = lr."dueDate"
         AND dg."paymentTypeId" = COALESCE(lr."paymentTypeId", 0)
         AND dg.amount = lr.amount
         AND dg."installmentNumber" = lr."installmentNumber"
         AND dg."totalInstallments" = lr."totalInstallments"
      )
      SELECT
        open_row."customerId",
        open_row."customerName",
        open_row."dueDate",
        open_row."paymentTypeId",
        open_row."paymentTypeName",
        open_row.amount,
        open_row."installmentNumber",
        open_row."totalInstallments",
        open_row."rowCount",
        open_row."settledCount",
        open_row."openCount",
        paid_row."receivableId" AS "keptReceivableId",
        paid_row."installmentId" AS "keptInstallmentId",
        paid_row."receivableStatus" AS "keptReceivableStatus",
        paid_row."installmentStatus" AS "keptInstallmentStatus",
        paid_row."paidAmount" AS "keptPaidAmount",
        paid_row."receiptCount" AS "keptReceiptCount",
        paid_row."receiptAmount" AS "keptReceiptAmount",
        paid_row."lastPaidAt" AS "keptLastPaidAt",
        paid_row."createdAt" AS "keptCreatedAt",
        open_row."receivableId" AS "deletedReceivableId",
        open_row."installmentId" AS "deletedInstallmentId",
        open_row."receivableStatus" AS "deletedReceivableStatus",
        open_row."installmentStatus" AS "deletedInstallmentStatus",
        open_row."receivableOpenAmount" AS "deletedOpenAmount",
        open_row."paidAmount" AS "deletedPaidAmount",
        open_row."receiptCount" AS "deletedReceiptCount",
        open_row."createdAt" AS "deletedCreatedAt"
      FROM ranked_rows open_row
      JOIN ranked_rows paid_row
        ON paid_row."customerId" = open_row."customerId"
       AND paid_row."dueDate" = open_row."dueDate"
       AND COALESCE(paid_row."paymentTypeId", 0) = COALESCE(open_row."paymentTypeId", 0)
       AND paid_row.amount = open_row.amount
       AND paid_row."installmentNumber" = open_row."installmentNumber"
       AND paid_row."totalInstallments" = open_row."totalInstallments"
       AND paid_row."settlementKind" = 'SETTLED'
       AND paid_row."groupRank" = 1
      WHERE open_row."settlementKind" = 'OPEN'
      ORDER BY
        open_row."dueDate" ASC,
        open_row."customerName" ASC NULLS LAST,
        open_row."customerId" ASC,
        open_row."paymentTypeName" ASC NULLS LAST,
        open_row.amount ASC,
        open_row."receivableId" ASC
      ${filters.limit ? 'LIMIT :limit' : ""}
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => ({
    ...row,
    customerId: Number(row.customerId),
    paymentTypeId: row.paymentTypeId ? Number(row.paymentTypeId) : null,
    installmentNumber: Number(row.installmentNumber),
    totalInstallments: Number(row.totalInstallments),
    rowCount: Number(row.rowCount),
    settledCount: Number(row.settledCount),
    openCount: Number(row.openCount),
    keptReceivableId: Number(row.keptReceivableId),
    keptInstallmentId: Number(row.keptInstallmentId),
    keptReceiptCount: Number(row.keptReceiptCount || 0),
    deletedReceivableId: Number(row.deletedReceivableId),
    deletedInstallmentId: Number(row.deletedInstallmentId),
    deletedReceiptCount: Number(row.deletedReceiptCount || 0),
  }));
}

async function deleteReceivables(receivableIds) {
  if (!receivableIds.length) {
    return 0;
  }

  return sequelize.transaction(async (transaction) => {
    const [deletedReceipts] = await sequelize.query(
      `
        DELETE FROM payment_receipts
        WHERE "receivableInstallmentId" IN (
          SELECT ri."idReceivableInstallment"
          FROM receivable_installments ri
          WHERE ri."receivableId" IN (:receivableIds)
        )
        RETURNING "idPaymentReceipt"
      `,
      {
        replacements: { receivableIds },
        transaction,
      },
    );

    const [deletedInstallments] = await sequelize.query(
      `
        DELETE FROM receivable_installments
        WHERE "receivableId" IN (:receivableIds)
        RETURNING "idReceivableInstallment"
      `,
      {
        replacements: { receivableIds },
        transaction,
      },
    );

    const [deletedReceivables] = await sequelize.query(
      `
        DELETE FROM receivables
        WHERE "idReceivable" IN (:receivableIds)
        RETURNING "idReceivable"
      `,
      {
        replacements: { receivableIds },
        transaction,
      },
    );

    return {
      deletedReceiptsCount: Array.isArray(deletedReceipts) ? deletedReceipts.length : 0,
      deletedInstallmentsCount: Array.isArray(deletedInstallments)
        ? deletedInstallments.length
        : 0,
      deletedReceivablesCount: Array.isArray(deletedReceivables)
        ? deletedReceivables.length
        : 0,
    };
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function logPreview(rows) {
  console.log(`Duplicidades elegiveis encontradas: ${rows.length}`);

  if (!rows.length) {
    return;
  }

  for (const row of rows.slice(0, 50)) {
    const installmentLabel = `${row.installmentNumber}/${row.totalInstallments}`;
    console.log(
      [
        `- Cliente ${row.customerId} (${row.customerName || "sem nome"})`,
        `venc. ${row.dueDate}`,
        `parcela ${installmentLabel}`,
        `forma ${row.paymentTypeName || row.paymentTypeId || "-"}`,
        `valor ${formatMoney(row.amount)}`,
        `manter ${row.keptReceivableId} (recb. ${formatMoney(row.keptPaidAmount)} / recibos ${row.keptReceiptCount})`,
        `apagar ${row.deletedReceivableId} (saldo ${formatMoney(row.deletedOpenAmount)} / recibos ${row.deletedReceiptCount})`,
      ].join(" | "),
    );
  }

  const extraCount = rows.length - 50;
  if (extraCount > 0) {
    console.log(`... mais ${extraCount} duplicidades nao exibidas.`);
  }
}

async function main() {
  try {
    const filters = readArgs();
    const rows = await findDuplicateCandidates(filters);

    logPreview(rows);

    if (!filters.apply) {
      console.log(
        "\nModo simulacao: nada foi apagado. Rode com --apply para excluir os registros em aberto listados acima.",
      );
      return;
    }

    const receivableIdsToDelete = [...new Set(rows.map((row) => row.deletedReceivableId))];

    if (!receivableIdsToDelete.length) {
      console.log("\nNenhum registro elegivel para exclusao.");
      return;
    }

    const deletionSummary = await deleteReceivables(receivableIdsToDelete);

    console.log(`\nRecebiveis apagados: ${deletionSummary.deletedReceivablesCount}`);
    console.log(`Parcelas apagadas: ${deletionSummary.deletedInstallmentsCount}`);
    console.log(`Recebimentos apagados: ${deletionSummary.deletedReceiptsCount}`);
  } catch (error) {
    console.error("Erro ao remover duplicidades legadas do contas a receber:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  void main();
}

module.exports = {
  findDuplicateCandidates,
  readArgs,
};
