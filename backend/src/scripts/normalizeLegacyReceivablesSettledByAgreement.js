require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

async function normalizeLegacyReceivablesSettledByAgreement() {
  try {
    const candidates = await sequelize.query(
      `
        SELECT
          ri."idReceivableInstallment" AS "installmentId",
          ri."receivableId" AS "receivableId",
          ri.amount AS "amount",
          ri."paidAmount" AS "paidAmount",
          ri.status AS "installmentStatus",
          r.status AS "receivableStatus",
          r."openAmount" AS "openAmount"
        FROM receivable_installments ri
        JOIN receivables r
          ON r."idReceivable" = ri."receivableId"
        WHERE r."saleId" IS NULL
          AND ri."paidAmount" > 0
          AND ri."paidAmount" < ri.amount
      `,
      {
        type: QueryTypes.SELECT,
      },
    );

    console.log(`Titulos legados com pagamento parcial tratado como acordo: ${candidates.length}`);

    if (!candidates.length) {
      return;
    }

    await sequelize.transaction(async (transaction) => {
      await sequelize.query(
        `
          UPDATE receivable_installments ri
          SET
            status = 'PAID',
            "updatedAt" = NOW()
          FROM receivables r
          WHERE r."idReceivable" = ri."receivableId"
            AND r."saleId" IS NULL
            AND ri."paidAmount" > 0
            AND ri."paidAmount" < ri.amount
        `,
        { transaction },
      );

      await sequelize.query(
        `
          UPDATE receivables r
          SET
            status = 'PAID',
            "openAmount" = 0,
            "updatedAt" = NOW()
          WHERE r."saleId" IS NULL
            AND EXISTS (
              SELECT 1
              FROM receivable_installments ri
              WHERE ri."receivableId" = r."idReceivable"
                AND ri."paidAmount" > 0
                AND ri."paidAmount" < ri.amount
            )
        `,
        { transaction },
      );
    });

    console.log("Normalizacao de acordos do legado concluida.");
  } catch (error) {
    console.error("Erro ao normalizar acordos do legado:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

normalizeLegacyReceivablesSettledByAgreement();
