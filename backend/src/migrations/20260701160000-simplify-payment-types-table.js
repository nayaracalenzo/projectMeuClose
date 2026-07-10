"use strict";

function getLegacyPresetByDesc(desc) {
  const normalizedDesc = String(desc || "")
    .trim()
    .toUpperCase();

  if (normalizedDesc === "DINHEIRO") {
    return {
      kind: "CASH",
      requiresDueDate: false,
      allowsEntryAmount: false,
      allowedEntryPaymentKinds: [],
      allowsInstallments: false,
      maxInstallments: 1,
      defaultInstallments: 1,
      financialFlow: "IMMEDIATE_CASH",
    };
  }

  if (normalizedDesc === "CHEQUE DIA") {
    return {
      kind: "CHECK",
      requiresDueDate: false,
      allowsEntryAmount: false,
      allowedEntryPaymentKinds: [],
      allowsInstallments: false,
      maxInstallments: 1,
      defaultInstallments: 1,
      financialFlow: "IMMEDIATE_CASH",
    };
  }

  if (
    normalizedDesc === "CHEQUE PRE" ||
    normalizedDesc === "CARNE" ||
    normalizedDesc === "DUPLICATA"
  ) {
    return {
      kind:
        normalizedDesc === "CARNE"
          ? "BOOKLET"
          : normalizedDesc === "DUPLICATA"
            ? "INVOICE"
            : "CHECK",
      requiresDueDate: true,
      allowsEntryAmount: true,
      allowedEntryPaymentKinds: ["CASH", "CHECK"],
      allowsInstallments: true,
      maxInstallments: 12,
      defaultInstallments: 1,
      financialFlow: "FUTURE_CUSTOMER",
    };
  }

  if (normalizedDesc.startsWith("CARTAO")) {
    return {
      kind: "CARD",
      requiresDueDate: false,
      allowsEntryAmount: true,
      allowedEntryPaymentKinds: ["CASH", "CHECK"],
      allowsInstallments: false,
      maxInstallments: 1,
      defaultInstallments: 1,
      financialFlow: "FUTURE_OPERATOR",
    };
  }

  return {
    kind: "CASH",
    requiresDueDate: false,
    allowsEntryAmount: false,
    allowedEntryPaymentKinds: [],
    allowsInstallments: false,
    maxInstallments: 1,
    defaultInstallments: 1,
    financialFlow: "IMMEDIATE_CASH",
  };
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable("payment_types");

    const removableColumns = [
      "kind",
      "active",
      "requiresDueDate",
      "allowsEntryAmount",
      "allowedEntryPaymentKinds",
      "allowsInstallments",
      "maxInstallments",
      "defaultInstallments",
      "financialFlow",
      "createdAt",
      "updatedAt",
    ];

    for (const column of removableColumns) {
      if (table[column]) {
        await queryInterface.removeColumn("payment_types", column);
      }
    }

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payment_types_kind";');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_payment_types_financialFlow";',
    );
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("payment_types");

    if (!table.kind) {
      await queryInterface.addColumn("payment_types", "kind", {
        type: Sequelize.ENUM("CASH", "CHECK", "BOOKLET", "INVOICE", "CARD"),
        allowNull: true,
      });
    }

    if (!table.active) {
      await queryInterface.addColumn("payment_types", "active", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    if (!table.requiresDueDate) {
      await queryInterface.addColumn("payment_types", "requiresDueDate", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!table.allowsEntryAmount) {
      await queryInterface.addColumn("payment_types", "allowsEntryAmount", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!table.allowedEntryPaymentKinds) {
      await queryInterface.addColumn("payment_types", "allowedEntryPaymentKinds", {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }

    if (!table.allowsInstallments) {
      await queryInterface.addColumn("payment_types", "allowsInstallments", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!table.maxInstallments) {
      await queryInterface.addColumn("payment_types", "maxInstallments", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!table.defaultInstallments) {
      await queryInterface.addColumn("payment_types", "defaultInstallments", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      });
    }

    if (!table.financialFlow) {
      await queryInterface.addColumn("payment_types", "financialFlow", {
        type: Sequelize.ENUM("IMMEDIATE_CASH", "FUTURE_CUSTOMER", "FUTURE_OPERATOR"),
        allowNull: false,
        defaultValue: "IMMEDIATE_CASH",
      });
    }

    if (!table.createdAt) {
      await queryInterface.addColumn("payment_types", "createdAt", {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      });
    }

    if (!table.updatedAt) {
      await queryInterface.addColumn("payment_types", "updatedAt", {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      });
    }

    const rows = await queryInterface.sequelize.query(
      'SELECT "idPaymentType", "desc" FROM payment_types',
      { type: Sequelize.QueryTypes.SELECT },
    );

    for (const row of rows) {
      const preset = getLegacyPresetByDesc(row.desc);
      await queryInterface.sequelize.query(
        `
          UPDATE payment_types
          SET
            "kind" = :kind,
            "active" = true,
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
            idPaymentType: row.idPaymentType,
            kind: preset.kind,
            requiresDueDate: preset.requiresDueDate,
            allowsEntryAmount: preset.allowsEntryAmount,
            allowedEntryPaymentKinds: JSON.stringify(preset.allowedEntryPaymentKinds),
            allowsInstallments: preset.allowsInstallments,
            maxInstallments: preset.maxInstallments,
            defaultInstallments: preset.defaultInstallments,
            financialFlow: preset.financialFlow,
          },
        },
      );
    }
  },
};
