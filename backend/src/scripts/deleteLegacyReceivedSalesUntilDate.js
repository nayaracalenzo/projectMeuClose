require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { Receivables, Sales, sequelize } = require("../models");

const DEFAULT_CUTOFF = "2025-05-23";

function normalizeCutoffDate(value) {
  if (!value) return DEFAULT_CUTOFF;

  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Use a data de corte no formato YYYY-MM-DD.");
  }

  return normalized;
}

async function listEligibleReceivables(cutoffDate) {
  return sequelize.query(
    `
      SELECT
        r."idReceivable" AS "receivableId",
        r."saleId" AS "saleId",
        r."status" AS "receivableStatus",
        r."openAmount" AS "openAmount",
        r."saleId" IS NOT NULL AS "hasLinkedSale",
        MIN(ri."dueDate"::date) AS "firstDueDate",
        MAX(ri."dueDate"::date) AS "lastDueDate",
        COUNT(*)::int AS "installmentCount"
      FROM receivables r
      JOIN receivable_installments ri
        ON ri."receivableId" = r."idReceivable"
      GROUP BY r."idReceivable", r."saleId", r."status", r."openAmount"
      HAVING MAX(ri."dueDate"::date) <= :cutoffDate::date
      ORDER BY MAX(ri."dueDate"::date) ASC, r."saleId" ASC
    `,
    {
      replacements: {
        cutoffDate,
      },
      type: QueryTypes.SELECT,
    },
  );
}

async function listMixedDateSales(cutoffDate) {
  return sequelize.query(
    `
      SELECT
        r."saleId" AS "saleId",
        MIN(ri."dueDate"::date) AS "firstDueDate",
        MAX(ri."dueDate"::date) AS "lastDueDate",
        COUNT(*)::int AS "installmentCount"
      FROM receivables r
      JOIN receivable_installments ri
        ON ri."receivableId" = r."idReceivable"
      WHERE r."saleId" IS NOT NULL
      GROUP BY r."saleId"
      HAVING MIN(ri."dueDate"::date) <= :cutoffDate::date
         AND MAX(ri."dueDate"::date) > :cutoffDate::date
      ORDER BY MIN(ri."dueDate"::date) ASC, r."saleId" ASC
    `,
    {
      replacements: {
        cutoffDate,
      },
      type: QueryTypes.SELECT,
    },
  );
}

async function listEligibleSales(cutoffDate) {
  return sequelize.query(
    `
      SELECT
        s."idSale" AS "saleId",
        s.status AS "saleStatus",
        s."createdAt"::date AS "saleDate",
        s."customerId" AS "customerId",
        s."finalAmount" AS "finalAmount"
      FROM sales s
      WHERE s."createdAt"::date <= :cutoffDate::date
      ORDER BY s."createdAt"::date ASC, s."idSale" ASC
    `,
    {
      replacements: {
        cutoffDate,
      },
      type: QueryTypes.SELECT,
    },
  );
}

async function deleteReceivablesByCutoff(cutoffDate, transaction) {
  await sequelize.query(
    `
      DELETE FROM receivables r
      USING (
        SELECT r2."idReceivable"
        FROM receivables r2
        JOIN receivable_installments ri
          ON ri."receivableId" = r2."idReceivable"
        GROUP BY r2."idReceivable"
        HAVING MAX(ri."dueDate"::date) <= :cutoffDate::date
      ) targets
      WHERE r."idReceivable" = targets."idReceivable"
      RETURNING r."idReceivable"
    `,
    {
      replacements: {
        cutoffDate,
      },
      transaction,
    },
  );
}

async function deleteSalesByCutoff(cutoffDate, transaction) {
  await sequelize.query(
    `
      DELETE FROM sales s
      WHERE s."createdAt"::date <= :cutoffDate::date
      RETURNING s."idSale"
    `,
    {
      replacements: {
        cutoffDate,
      },
      transaction,
    },
  );
}

async function deleteLegacyReceivedSalesUntilDate({ cutoffDate = DEFAULT_CUTOFF, apply = false } = {}) {
  const normalizedCutoffDate = normalizeCutoffDate(cutoffDate);

  try {
    const [eligibleReceivables, mixedDateSales, eligibleSales] = await Promise.all([
      listEligibleReceivables(normalizedCutoffDate),
      listMixedDateSales(normalizedCutoffDate),
      listEligibleSales(normalizedCutoffDate),
    ]);

    const receivableIds = eligibleReceivables.map((item) => Number(item.receivableId)).filter(Boolean);
    const saleIds = eligibleSales.map((item) => Number(item.saleId)).filter(Boolean);
    const receivablesWithLinkedSales = eligibleReceivables.filter((item) => item.hasLinkedSale).length;
    const receivablesWithoutLinkedSales = eligibleReceivables.length - receivablesWithLinkedSales;

    console.log(`Data de corte: ${normalizedCutoffDate}`);
    console.log(`Titulos elegiveis para exclusão: ${receivableIds.length}`);
    console.log(`Vendas elegiveis para exclusão: ${saleIds.length}`);
    console.log(`Titulos elegiveis sem vinculo de venda: ${receivablesWithoutLinkedSales}`);
    console.log(`Titulos elegiveis com vinculo de venda: ${receivablesWithLinkedSales}`);
    console.log(`Vendas com parcelas antes e depois do corte (serao ignoradas): ${mixedDateSales.length}`);

    if (eligibleReceivables.length) {
      console.log("\nPrimeiros titulos elegiveis:");
      for (const item of eligibleReceivables.slice(0, 20)) {
        console.log(
          `- Titulo ${item.receivableId} | venda ${item.saleId || "-"} | vencimentos ${item.firstDueDate} -> ${item.lastDueDate} | parcelas ${item.installmentCount} | status ${item.receivableStatus} | saldo ${item.openAmount}`,
        );
      }
    }

    if (eligibleSales.length) {
      console.log("\nPrimeiras vendas elegiveis:");
      for (const item of eligibleSales.slice(0, 20)) {
        console.log(
          `- Venda ${item.saleId} | data ${item.saleDate} | status ${item.saleStatus} | cliente ${item.customerId} | valor ${item.finalAmount}`,
        );
      }
    }

    if (mixedDateSales.length) {
      console.log("\nVendas ignoradas por terem parcelas apos a data de corte:");
      for (const item of mixedDateSales.slice(0, 20)) {
        console.log(
          `- Venda ${item.saleId} | vencimentos ${item.firstDueDate} -> ${item.lastDueDate} | parcelas ${item.installmentCount}`,
        );
      }
    }

    if (!apply) {
      console.log("\nModo simulacao: nada foi excluido. Rode com --apply para efetivar.");
      return {
        receivableIds,
        saleIds,
        mixedDateSales,
      };
    }

    if (!receivableIds.length && !saleIds.length) {
      console.log("\nNenhum registro elegivel para exclusão.");
      return {
        receivableIds,
        saleIds,
        mixedDateSales,
      };
    }

    const transaction = await sequelize.transaction();

    try {
      let deletedReceivables = 0;
      let deletedSales = 0;

      if (receivableIds.length) {
        await deleteReceivablesByCutoff(normalizedCutoffDate, transaction);
        deletedReceivables = receivableIds.length;
      }

      if (saleIds.length) {
        await deleteSalesByCutoff(normalizedCutoffDate, transaction);
        deletedSales = saleIds.length;
      }

      await transaction.commit();

      console.log(`\nTitulos excluidos do A Receber: ${deletedReceivables}`);
      console.log(`Vendas excluidas: ${deletedSales}`);

      return {
        deletedReceivables,
        deletedSales,
        mixedDateSales,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Erro ao excluir vendas e titulos antigos:", error.message);
    process.exitCode = 1;
    return null;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  const apply = process.argv.includes("--apply");
  const cutoffArg = process.argv.find((argument) => argument.startsWith("--cutoff="));
  const cutoffDate = cutoffArg ? cutoffArg.split("=")[1] : DEFAULT_CUTOFF;

  void deleteLegacyReceivedSalesUntilDate({
    cutoffDate,
    apply,
  });
}

module.exports = {
  deleteLegacyReceivedSalesUntilDate,
  normalizeCutoffDate,
};
