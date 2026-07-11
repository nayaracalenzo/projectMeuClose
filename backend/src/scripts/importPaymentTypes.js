require("dotenv").config();
const { PaymentTypes } = require("../models");

const paymentTypes = [
  { idPaymentType: 1, desc: "DINHEIRO", active: true },
  { idPaymentType: 2, desc: "CHEQUE DIA", active: true },
  { idPaymentType: 3, desc: "CHEQUE PRE", active: true },
  { idPaymentType: 4, desc: "CARNE", active: true },
  { idPaymentType: 5, desc: "DUPLICATA", active: true },
  { idPaymentType: 6, desc: "CARTAO CREDITO", active: true },
  { idPaymentType: 7, desc: "CARTAO VISA", active: true },
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
