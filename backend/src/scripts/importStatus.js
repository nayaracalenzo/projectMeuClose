require('dotenv').config();
const { Status } = require('../models');

const statusList = [
  { id: 1, desc: 'a produzir' },
  { id: 2, desc: 'produzida' },
  { id: 3, desc: 'entregue' },
  { id: 4, desc: 'cancelada' },
];

async function importStatus() {
  try {
    for (const item of statusList) {
      await Status.upsert(item);
      console.log(`Importado: ${item.id} - ${item.desc}`);
    }

    console.log('Importacao de status finalizada!');
  } catch (error) {
    console.error('Erro ao importar status:', error.message);
    process.exitCode = 1;
  } finally {
    await Status.sequelize.close();
  }
}

importStatus();
