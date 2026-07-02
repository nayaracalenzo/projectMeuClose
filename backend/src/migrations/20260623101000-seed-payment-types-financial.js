module.exports = {
  async up(queryInterface) {
    const paymentTypes = [
      [1, "DINHEIRO", "CASH", false, false, [], false, 1, 1, "IMMEDIATE_CASH"],
      [2, "CHEQUE DIA", "CHECK", false, false, [], false, 1, 1, "IMMEDIATE_CASH"],
      [3, "CHEQUE PRE", "CHECK", true, true, ["CASH", "CHECK"], true, 12, 1, "FUTURE_CUSTOMER"],
      [4, "CARNE", "BOOKLET", true, true, ["CASH", "CHECK"], true, 12, 1, "FUTURE_CUSTOMER"],
      [5, "DUPLICATA", "INVOICE", true, true, ["CASH", "CHECK"], true, 12, 1, "FUTURE_CUSTOMER"],
      [6, "CARTAO CREDITO", "CARD", false, true, ["CASH", "CHECK"], false, 1, 1, "FUTURE_OPERATOR"],
      [7, "CARTAO VISA", "CARD", false, true, ["CASH", "CHECK"], false, 1, 1, "FUTURE_OPERATOR"],
    ];

    for (const [
      idPaymentType,
      desc,
      kind,
      requiresDueDate,
      allowsEntryAmount,
      allowedEntryPaymentKinds,
      allowsInstallments,
      maxInstallments,
      defaultInstallments,
      financialFlow,
    ] of paymentTypes) {
      await queryInterface.sequelize.query(
        `
          INSERT INTO payment_types (
            "idPaymentType",
            "desc",
            "kind",
            "requiresDueDate",
            "allowsEntryAmount",
            "allowedEntryPaymentKinds",
            "allowsInstallments",
            "maxInstallments",
            "defaultInstallments",
            "financialFlow",
            "active",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            :idPaymentType,
            :desc,
            :kind,
            :requiresDueDate,
            :allowsEntryAmount,
            CAST(:allowedEntryPaymentKinds AS jsonb),
            :allowsInstallments,
            :maxInstallments,
            :defaultInstallments,
            :financialFlow,
            true,
            NOW(),
            NOW()
          )
          ON CONFLICT ("idPaymentType")
          DO UPDATE SET
            "desc" = EXCLUDED."desc",
            "kind" = EXCLUDED."kind",
            "requiresDueDate" = EXCLUDED."requiresDueDate",
            "allowsEntryAmount" = EXCLUDED."allowsEntryAmount",
            "allowedEntryPaymentKinds" = EXCLUDED."allowedEntryPaymentKinds",
            "allowsInstallments" = EXCLUDED."allowsInstallments",
            "maxInstallments" = EXCLUDED."maxInstallments",
            "defaultInstallments" = EXCLUDED."defaultInstallments",
            "financialFlow" = EXCLUDED."financialFlow",
            "active" = EXCLUDED."active",
            "updatedAt" = NOW()
        `,
        {
          replacements: {
            idPaymentType,
            desc,
            kind,
            requiresDueDate,
            allowsEntryAmount,
            allowedEntryPaymentKinds: JSON.stringify(allowedEntryPaymentKinds),
            allowsInstallments,
            maxInstallments,
            defaultInstallments,
            financialFlow,
          },
        }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM payment_types
      WHERE "idPaymentType" IN (1, 2, 3, 4, 5, 6, 7)
    `);
  },
};
