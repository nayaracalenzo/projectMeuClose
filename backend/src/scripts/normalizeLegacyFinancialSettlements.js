require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

function parseIdList(rawValue) {
  if (!rawValue) return [];

  return [...new Set(
    String(rawValue)
      .split(",")
      .map((value) => Number(String(value).trim()))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];
}

function readArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    receivableIds: [],
    payableIds: [],
    dryRun: false,
  };

  args.forEach((arg) => {
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      return;
    }

    if (arg.startsWith("--receivable-ids=")) {
      parsed.receivableIds = parseIdList(arg.slice("--receivable-ids=".length));
      return;
    }

    if (arg.startsWith("--payable-ids=")) {
      parsed.payableIds = parseIdList(arg.slice("--payable-ids=".length));
    }
  });

  return parsed;
}

async function findReceivableCandidates(receivableIds) {
  return sequelize.query(
    `
      SELECT DISTINCT r."idReceivable" AS "receivableId"
      FROM receivables r
      JOIN receivable_installments ri
        ON ri."receivableId" = r."idReceivable"
      WHERE r."saleId" IS NULL
        AND ri."paidAmount" > 0
        AND ri."paidAmount" < ri.amount
        AND EXISTS (
          SELECT 1
          FROM payment_receipts pr
          WHERE pr."receivableInstallmentId" = ri."idReceivableInstallment"
        )
        AND (
          r."openAmount" > 0
          OR r.status <> 'PAID'
          OR ri.status <> 'PAID'
        )
        ${
          receivableIds.length
            ? 'AND r."idReceivable" IN (:receivableIds)'
            : ""
        }
      ORDER BY r."idReceivable"
    `,
    {
      replacements: { receivableIds },
      type: QueryTypes.SELECT,
    },
  );
}

async function findPayableCandidates(payableIds) {
  return sequelize.query(
    `
      SELECT DISTINCT p."idPayable" AS "payableId"
      FROM payables p
      WHERE p."openAmount" > 0
        AND p."openAmount" < p.amount
        AND EXISTS (
          SELECT 1
          FROM payable_payments pp
          WHERE pp."payableId" = p."idPayable"
        )
        ${
          payableIds.length
            ? 'AND p."idPayable" IN (:payableIds)'
            : ""
        }
      ORDER BY p."idPayable"
    `,
    {
      replacements: { payableIds },
      type: QueryTypes.SELECT,
    },
  );
}

async function normalizeReceivables(receivableIds, transaction) {
  if (!receivableIds.length) return;

  await sequelize.query(
    `
      UPDATE receivable_installments ri
      SET
        "paidAmount" = ri.amount,
        status = 'PAID',
        "updatedAt" = NOW()
      WHERE ri."receivableId" IN (:receivableIds)
        AND EXISTS (
          SELECT 1
          FROM payment_receipts pr
          WHERE pr."receivableInstallmentId" = ri."idReceivableInstallment"
        )
    `,
    {
      replacements: { receivableIds },
      transaction,
    },
  );

  await sequelize.query(
    `
      UPDATE receivables r
      SET
        status = 'PAID',
        "openAmount" = 0,
        "updatedAt" = NOW()
      WHERE r."idReceivable" IN (:receivableIds)
    `,
    {
      replacements: { receivableIds },
      transaction,
    },
  );
}

async function normalizePayables(payableIds, transaction) {
  if (!payableIds.length) return;

  await sequelize.query(
    `
      UPDATE payables p
      SET
        status = 'PAID',
        "openAmount" = 0,
        "updatedAt" = NOW()
      WHERE p."idPayable" IN (:payableIds)
    `,
    {
      replacements: { payableIds },
      transaction,
    },
  );
}

async function main() {
  const { receivableIds, payableIds, dryRun } = readArgs();

  try {
    const receivableCandidates = await findReceivableCandidates(receivableIds);
    const payableCandidates = await findPayableCandidates(payableIds);

    const normalizedReceivableIds = receivableCandidates.map((item) => Number(item.receivableId));
    const normalizedPayableIds = payableCandidates.map((item) => Number(item.payableId));

    console.log(`Recebiveis elegiveis: ${normalizedReceivableIds.length}`);
    if (normalizedReceivableIds.length) {
      console.log(`IDs recebiveis: ${normalizedReceivableIds.join(", ")}`);
    }

    console.log(`Pagaveis elegiveis: ${normalizedPayableIds.length}`);
    if (normalizedPayableIds.length) {
      console.log(`IDs pagaveis: ${normalizedPayableIds.join(", ")}`);
    }

    if (dryRun) {
      console.log("Execucao em dry-run. Nenhuma alteracao foi aplicada.");
      return;
    }

    await sequelize.transaction(async (transaction) => {
      await normalizeReceivables(normalizedReceivableIds, transaction);
      await normalizePayables(normalizedPayableIds, transaction);
    });

    console.log("Normalizacao de registros legados concluida.");
  } catch (error) {
    console.error("Erro ao normalizar registros legados:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
