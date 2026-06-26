require("dotenv").config();
const { PaymentTypes } = require("../models");

const paymentTypes = [
  {
    idPaymentType: 1,
    desc: "DINHEIRO",
    kind: "CASH",
    requiresDueDate: false,
    allowsEntryAmount: false,
    allowedEntryPaymentKinds: [],
    allowsInstallments: false,
    maxInstallments: 1,
    defaultInstallments: 1,
    financialFlow: "IMMEDIATE_CASH",
    active: true,
  },
  {
    idPaymentType: 2,
    desc: "CHEQUE DIA",
    kind: "CHECK",
    requiresDueDate: false,
    allowsEntryAmount: false,
    allowedEntryPaymentKinds: [],
    allowsInstallments: false,
    maxInstallments: 1,
    defaultInstallments: 1,
    financialFlow: "IMMEDIATE_CASH",
    active: true,
  },
  {
    idPaymentType: 3,
    desc: "CHEQUE PRE",
    kind: "CHECK",
    requiresDueDate: true,
    allowsEntryAmount: false,
    allowedEntryPaymentKinds: [],
    allowsInstallments: false,
    maxInstallments: 1,
    defaultInstallments: 1,
    financialFlow: "FUTURE_CUSTOMER",
    active: true,
  },
  {
    idPaymentType: 4,
    desc: "CARNE",
    kind: "BOOKLET",
    requiresDueDate: true,
    allowsEntryAmount: true,
    allowedEntryPaymentKinds: ["CASH", "CHECK"],
    allowsInstallments: true,
    maxInstallments: 12,
    defaultInstallments: 3,
    financialFlow: "FUTURE_CUSTOMER",
    active: true,
  },
  {
    idPaymentType: 5,
    desc: "DUPLICATA",
    kind: "INVOICE",
    requiresDueDate: true,
    allowsEntryAmount: true,
    allowedEntryPaymentKinds: ["CASH", "CHECK"],
    allowsInstallments: false,
    maxInstallments: 1,
    defaultInstallments: 1,
    financialFlow: "FUTURE_CUSTOMER",
    active: true,
  },
  {
    idPaymentType: 6,
    desc: "CARTAO CREDITO",
    kind: "CARD",
    requiresDueDate: false,
    allowsEntryAmount: true,
    allowedEntryPaymentKinds: ["CASH", "CHECK"],
    allowsInstallments: false,
    maxInstallments: 1,
    defaultInstallments: 1,
    financialFlow: "FUTURE_OPERATOR",
    active: true,
  },
  {
    idPaymentType: 7,
    desc: "CARTAO VISA",
    kind: "CARD",
    requiresDueDate: false,
    allowsEntryAmount: true,
    allowedEntryPaymentKinds: ["CASH", "CHECK"],
    allowsInstallments: false,
    maxInstallments: 1,
    defaultInstallments: 1,
    financialFlow: "FUTURE_OPERATOR",
    active: true,
  },
];

async function importPaymentTypes() {
  try {
    for (const item of paymentTypes) {
      await PaymentTypes.upsert(item);
      console.log(`Importado: ${item.idPaymentType} - ${item.desc}`);
    }

    console.log("Importacao finalizada!");
  } catch (error) {
    console.error("Erro ao importar tipos de pagamento:", error.message);
    process.exitCode = 1;
  } finally {
    await PaymentTypes.sequelize.close();
  }
}

importPaymentTypes();
