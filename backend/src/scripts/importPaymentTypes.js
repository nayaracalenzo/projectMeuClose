require("dotenv").config();
const { PaymentTypes } = require("../models");

const paymentTypes = [
  { idPaymentType: 1, desc: "DINHEIRO" },
  { idPaymentType: 2, desc: "CHEQUE DIA" },
  { idPaymentType: 3, desc: "CHEQUE PRE" },
  { idPaymentType: 4, desc: "CARNE" },
  { idPaymentType: 5, desc: "DUPLICATA" },
  { idPaymentType: 6, desc: "CARTAO CREDITO" },
  { idPaymentType: 7, desc: "CARTAO VISA" },
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
