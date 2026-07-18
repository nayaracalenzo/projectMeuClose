async function updatePaymentTypes(queryInterface, paymentTypes) {
  const table = await queryInterface.describeTable("payment_types");
  const updatableColumns = [
    table.allowsInstallments ? "allowsInstallments" : null,
    table.maxInstallments ? "maxInstallments" : null,
    table.defaultInstallments ? "defaultInstallments" : null,
    table.financialFlow ? "financialFlow" : null,
    table.updatedAt ? "updatedAt" : null,
  ].filter(Boolean);

  if (!updatableColumns.length) {
    return;
  }

  for (const config of paymentTypes) {
    const setClauses = [];
    const replacements = {
      idPaymentType: config.idPaymentType,
    };

    if (table.allowsInstallments) {
      setClauses.push(`"allowsInstallments" = :allowsInstallments`);
      replacements.allowsInstallments = config.allowsInstallments;
    }

    if (table.maxInstallments) {
      setClauses.push(`"maxInstallments" = :maxInstallments`);
      replacements.maxInstallments = config.maxInstallments;
    }

    if (table.defaultInstallments) {
      setClauses.push(`"defaultInstallments" = :defaultInstallments`);
      replacements.defaultInstallments = config.defaultInstallments;
    }

    if (table.financialFlow) {
      setClauses.push(`"financialFlow" = :financialFlow`);
      replacements.financialFlow = config.financialFlow;
    }

    if (table.updatedAt) {
      setClauses.push(`"updatedAt" = NOW()`);
    }

    await queryInterface.sequelize.query(
      `
        UPDATE payment_types
        SET ${setClauses.join(", ")}
        WHERE "idPaymentType" = :idPaymentType
      `,
      { replacements },
    );
  }
}

module.exports = {
  async up(queryInterface) {
    await updatePaymentTypes(queryInterface, [
      {
        idPaymentType: 6,
        allowsInstallments: true,
        maxInstallments: 12,
        defaultInstallments: 1,
        financialFlow: "FUTURE_CUSTOMER",
      },
      {
        idPaymentType: 7,
        allowsInstallments: true,
        maxInstallments: 12,
        defaultInstallments: 1,
        financialFlow: "FUTURE_CUSTOMER",
      },
    ]);
  },

  async down(queryInterface) {
    await updatePaymentTypes(queryInterface, [
      {
        idPaymentType: 6,
        allowsInstallments: false,
        maxInstallments: 1,
        defaultInstallments: 1,
        financialFlow: "FUTURE_OPERATOR",
      },
      {
        idPaymentType: 7,
        allowsInstallments: false,
        maxInstallments: 1,
        defaultInstallments: 1,
        financialFlow: "FUTURE_OPERATOR",
      },
    ]);
  },
};
