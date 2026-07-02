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
          UPDATE payment_types
          SET
            "desc" = :desc,
            "kind" = :kind,
            "requiresDueDate" = :requiresDueDate,
            "allowsEntryAmount" = :allowsEntryAmount,
            "allowedEntryPaymentKinds" = CAST(:allowedEntryPaymentKinds AS jsonb),
            "allowsInstallments" = :allowsInstallments,
            "maxInstallments" = :maxInstallments,
            "defaultInstallments" = :defaultInstallments,
            "financialFlow" = :financialFlow,
            "active" = true,
            "updatedAt" = NOW()
          WHERE "idPaymentType" = :idPaymentType
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
        },
      );
    }
  },

  async down(queryInterface) {
    const previousRules = [
      [1, false, false, [], false, 1, 1, "IMMEDIATE_CASH"],
      [2, false, false, [], false, 1, 1, "IMMEDIATE_CASH"],
      [3, true, false, [], false, 1, 1, "FUTURE_CUSTOMER"],
      [4, true, true, ["CASH", "CHECK"], true, 12, 3, "FUTURE_CUSTOMER"],
      [5, true, true, ["CASH", "CHECK"], false, 1, 1, "FUTURE_CUSTOMER"],
      [6, false, true, ["CASH", "CHECK"], false, 1, 1, "FUTURE_OPERATOR"],
      [7, false, true, ["CASH", "CHECK"], false, 1, 1, "FUTURE_OPERATOR"],
    ];

    for (const [
      idPaymentType,
      requiresDueDate,
      allowsEntryAmount,
      allowedEntryPaymentKinds,
      allowsInstallments,
      maxInstallments,
      defaultInstallments,
      financialFlow,
    ] of previousRules) {
      await queryInterface.sequelize.query(
        `
          UPDATE payment_types
          SET
            "requiresDueDate" = :requiresDueDate,
            "allowsEntryAmount" = :allowsEntryAmount,
            "allowedEntryPaymentKinds" = CAST(:allowedEntryPaymentKinds AS jsonb),
            "allowsInstallments" = :allowsInstallments,
            "maxInstallments" = :maxInstallments,
            "defaultInstallments" = :defaultInstallments,
            "financialFlow" = :financialFlow,
            "updatedAt" = NOW()
          WHERE "idPaymentType" = :idPaymentType
        `,
        {
          replacements: {
            idPaymentType,
            requiresDueDate,
            allowsEntryAmount,
            allowedEntryPaymentKinds: JSON.stringify(allowedEntryPaymentKinds),
            allowsInstallments,
            maxInstallments,
            defaultInstallments,
            financialFlow,
          },
        },
      );
    }
  },
};
