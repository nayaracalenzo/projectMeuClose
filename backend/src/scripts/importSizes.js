require('dotenv').config();
const { Sizes } = require('../models');

const sizesList = [
  { id: 16, desc: 'P' },
  { id: 17, desc: 'M' },
  { id: 18, desc: 'G' },
  { id: 19, desc: 'GG' },
  { id: 20, desc: '38' },
  { id: 21, desc: '40' },
  { id: 22, desc: '42' },
  { id: 23, desc: '48' },
  { id: 24, desc: 'U' },
  { id: 25, desc: '44' },
  { id: 26, desc: '46' },
  { id: 27, desc: '50' },
  { id: 28, desc: '36' },
  { id: 29, desc: 'VAR' },
  { id: 30, desc: 'EXG' },
  { id: 31, desc: '52' },
  { id: 32, desc: 'PP' },
];

async function importSizes() {
  try {
    for (const item of sizesList) {
      await Sizes.upsert(item);
      console.log(`Importado: ${item.id} - ${item.desc}`);
    }

    console.log('Importacao de tamanhos finalizada!');
  } catch (error) {
    console.error('Erro ao importar tamanhos:', error.message);
    process.exitCode = 1;
  } finally {
    await Sizes.sequelize.close();
  }
}

importSizes();
