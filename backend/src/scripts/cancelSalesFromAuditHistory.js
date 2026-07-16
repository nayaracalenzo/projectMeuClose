require("dotenv").config();
const { Audits, Receivables, Sales, sequelize } = require("../models");

function normalizeHistory(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSaleIdFromHistory(history) {
  const normalized = normalizeHistory(history);
  if (!normalized) return null;

  const match = normalized.match(/\bvenda\s*(?:n[ºo°.]*\s*)?[:#-]?\s*(\d+)\b/i);
  if (!match) return null;

  const saleId = Number(match[1]);
  return Number.isInteger(saleId) && saleId > 0 ? saleId : null;
}

function extractLegacyEntityId(history) {
  const normalized = normalizeHistory(history);
  if (!normalized) return null;

  const match = normalized.match(/\bId:\s*(\d+)\b/i);
  if (!match) return null;

  const entityId = Number(match[1]);
  return Number.isInteger(entityId) && entityId > 0 ? entityId : null;
}

async function cancelSalesFromAuditHistory({ apply = false } = {}) {
  try {
    const audits = await Audits.findAll({
      attributes: ["idAudit", "auditTypeId", "occurredAt", "history"],
      order: [["idAudit", "ASC"]],
      raw: true,
    });

    const saleAuditMap = new Map();
    const receivableAuditMap = new Map();

    for (const audit of audits) {
      const normalizedHistory = normalizeHistory(audit.history);
      const saleId = extractSaleIdFromHistory(audit.history);
      const legacyEntityId = Number(audit.auditTypeId) === 1 ? extractLegacyEntityId(audit.history) : null;

      if (saleId) {
        if (!saleAuditMap.has(saleId)) {
          saleAuditMap.set(saleId, []);
        }

        saleAuditMap.get(saleId).push({
          idAudit: Number(audit.idAudit),
          auditTypeId: Number(audit.auditTypeId) || null,
          occurredAt: audit.occurredAt,
          history: normalizedHistory,
        });
      }

      if (saleId && legacyEntityId) {
        if (!receivableAuditMap.has(legacyEntityId)) {
          receivableAuditMap.set(legacyEntityId, []);
        }

        receivableAuditMap.get(legacyEntityId).push({
          idAudit: Number(audit.idAudit),
          saleId,
          occurredAt: audit.occurredAt,
          history: normalizedHistory,
        });
      }
    }

    const candidateSaleIds = Array.from(saleAuditMap.keys());

    if (!candidateSaleIds.length) {
      console.log("Nenhuma venda foi encontrada no historico da auditoria.");
      return;
    }

    const sales = await Sales.findAll({
      where: {
        idSale: candidateSaleIds,
      },
      attributes: ["idSale", "status"],
      raw: true,
    });

    const existingSalesMap = new Map(
      sales.map((sale) => [Number(sale.idSale), sale]),
    );

    const matchedSales = [];
    const missingSales = [];

    for (const saleId of candidateSaleIds) {
      const existingSale = existingSalesMap.get(saleId);

      if (!existingSale) {
        missingSales.push({
          saleId,
          audits: saleAuditMap.get(saleId) || [],
        });
        continue;
      }

      matchedSales.push({
        saleId,
        currentStatus: existingSale.status,
        audits: saleAuditMap.get(saleId) || [],
      });
    }

    const matchedSaleIds = matchedSales.map((item) => item.saleId);
    const salesToCancel = matchedSales.filter((item) => item.currentStatus !== "CANCELLED");
    const linkedReceivables = matchedSaleIds.length
      ? await Receivables.findAll({
          where: {
            saleId: matchedSaleIds,
          },
          attributes: ["idReceivable", "saleId", "status", "openAmount"],
          raw: true,
        })
      : [];
    const auditedReceivableIds = Array.from(receivableAuditMap.keys());
    const auditedReceivables = auditedReceivableIds.length
      ? await Receivables.findAll({
          where: {
            idReceivable: auditedReceivableIds,
          },
          attributes: ["idReceivable", "saleId", "status", "openAmount"],
          raw: true,
        })
      : [];
    const [heuristicReceivables] =
      matchedSaleIds.length
        ? await sequelize.query(`
            WITH sales_day AS (
              SELECT
                s."customerId",
                DATE(s."createdAt") AS sale_date,
                COUNT(*) FILTER (WHERE s."status" = 'CANCELLED') AS cancelled_count,
                COUNT(*) AS total_sales_count,
                ARRAY_AGG(s."idSale" ORDER BY s."idSale") FILTER (WHERE s."status" = 'CANCELLED') AS cancelled_sales
              FROM sales s
              WHERE s."idSale" IN (${matchedSaleIds.join(",")})
              GROUP BY s."customerId", DATE(s."createdAt")
            )
            SELECT
              r."idReceivable",
              r."saleId",
              r."status",
              r."openAmount",
              sd.cancelled_sales
            FROM sales_day sd
            JOIN receivables r
              ON r."customerId" = sd."customerId"
             AND DATE(r."createdAt") = sd.sale_date
            JOIN receivable_installments ri
              ON ri."receivableId" = r."idReceivable"
            WHERE sd.cancelled_count = 1
              AND sd.total_sales_count = 1
              AND r."status" IN ('OPEN', 'PARTIAL', 'OVERDUE')
              AND ri."status" IN ('OPEN', 'PARTIAL', 'OVERDUE')
            GROUP BY r."idReceivable", r."saleId", r."status", r."openAmount", sd.cancelled_sales
          `)
        : [[]];
    const [allCancelledDayReceivables] =
      matchedSaleIds.length
        ? await sequelize.query(`
            WITH sales_day AS (
              SELECT
                s."customerId",
                DATE(s."createdAt") AS sale_date,
                COUNT(*) FILTER (WHERE s."status" = 'CANCELLED') AS cancelled_count,
                COUNT(*) AS total_sales_count,
                ARRAY_AGG(s."idSale" ORDER BY s."idSale") FILTER (WHERE s."status" = 'CANCELLED') AS cancelled_sales
              FROM sales s
              WHERE s."idSale" IN (${matchedSaleIds.join(",")})
              GROUP BY s."customerId", DATE(s."createdAt")
            )
            SELECT
              r."idReceivable",
              r."saleId",
              r."status",
              r."openAmount",
              sd.cancelled_sales
            FROM sales_day sd
            JOIN receivables r
              ON r."customerId" = sd."customerId"
             AND DATE(r."createdAt") = sd.sale_date
            JOIN receivable_installments ri
              ON ri."receivableId" = r."idReceivable"
            WHERE sd.cancelled_count >= 1
              AND sd.total_sales_count = sd.cancelled_count
              AND sd.total_sales_count > 1
              AND r."status" IN ('OPEN', 'PARTIAL', 'OVERDUE')
              AND ri."status" IN ('OPEN', 'PARTIAL', 'OVERDUE')
            GROUP BY r."idReceivable", r."saleId", r."status", r."openAmount", sd.cancelled_sales
          `)
        : [[]];
    const receivableMap = new Map();

    for (const item of [
      ...linkedReceivables,
      ...auditedReceivables,
      ...heuristicReceivables,
      ...allCancelledDayReceivables,
    ]) {
      const id = Number(item.idReceivable);
      if (!id || receivableMap.has(id)) continue;
      receivableMap.set(id, item);
    }

    const receivableIdsToDelete = Array.from(receivableMap.keys());
    const receivablesToDelete = Array.from(receivableMap.values());

    console.log(`Auditorias lidas: ${audits.length}`);
    console.log(`Vendas identificadas no historico: ${candidateSaleIds.length}`);
    console.log(`Vendas existentes encontradas: ${matchedSales.length}`);
    console.log(`Vendas ja canceladas: ${matchedSales.length - salesToCancel.length}`);
    console.log(`Vendas nao encontradas: ${missingSales.length}`);
    console.log(`Titulos ligados diretamente por venda: ${linkedReceivables.length}`);
    console.log(`Titulos identificados pela auditoria do A Receber: ${auditedReceivables.length}`);
    console.log(`Titulos identificados por cliente/data da venda cancelada: ${heuristicReceivables.length}`);
    console.log(`Titulos identificados quando todas as vendas do dia foram canceladas: ${allCancelledDayReceivables.length}`);

    if (missingSales.length) {
      console.log("\nVendas mencionadas na auditoria mas ausentes no banco:");
      for (const item of missingSales.slice(0, 20)) {
        console.log(`- Venda ${item.saleId} | auditoria ${item.audits[0]?.idAudit || "-"}`);
      }
    }

    if (!salesToCancel.length && !receivableIdsToDelete.length) {
      console.log("\nNenhuma venda ou titulo precisa ser atualizado.");
      return;
    }

    if (salesToCancel.length) {
      console.log("\nVendas candidatas a cancelamento:");
      for (const item of salesToCancel.slice(0, 50)) {
        console.log(
          `- Venda ${item.saleId} | status atual: ${item.currentStatus} | auditoria ${item.audits[0]?.idAudit || "-"}`,
        );
      }
    }

    if (receivablesToDelete.length) {
      console.log("\nTitulos vinculados que serao removidos do A Receber:");
      for (const item of receivablesToDelete.slice(0, 50)) {
        const auditHints = receivableAuditMap.get(Number(item.idReceivable)) || [];
        const heuristicSaleId = Array.isArray(item.cancelled_sales)
          ? item.cancelled_sales[0]
          : Array.isArray(item.cancelledSales)
            ? item.cancelledSales[0]
            : null;
        console.log(
          `- Titulo ${item.idReceivable} | venda ${item.saleId || auditHints[0]?.saleId || heuristicSaleId || "-"} | status ${item.status} | saldo ${item.openAmount}`,
        );
      }
    }

    if (!apply) {
      console.log(
        "\nModo simulacao: nenhuma venda ou titulo foi alterado. Rode com --apply para efetivar.",
      );
      return;
    }

    const transaction = await sequelize.transaction();

    try {
      let updatedCount = 0;

      if (salesToCancel.length) {
        const updateResult = await Sales.update(
          {
            status: "CANCELLED",
          },
          {
            where: {
              idSale: salesToCancel.map((item) => item.saleId),
            },
            transaction,
          },
        );
        updatedCount = Array.isArray(updateResult) ? Number(updateResult[0] || 0) : Number(updateResult || 0);
      }

      let deletedReceivablesCount = 0;

      if (receivableIdsToDelete.length) {
        deletedReceivablesCount = await Receivables.destroy({
          where: {
            idReceivable: receivableIdsToDelete,
          },
          transaction,
        });
      }

      await transaction.commit();

      console.log(`\nVendas atualizadas para CANCELLED: ${updatedCount}`);
      console.log(`Titulos removidos do A Receber: ${deletedReceivablesCount}`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Erro ao cancelar vendas a partir da auditoria:", error.message);
    process.exitCode = 1;
  } finally {
    await Audits.sequelize.close();
  }
}

if (require.main === module) {
  const apply = process.argv.includes("--apply");
  void cancelSalesFromAuditHistory({ apply });
}

module.exports = {
  cancelSalesFromAuditHistory,
  extractSaleIdFromHistory,
};
