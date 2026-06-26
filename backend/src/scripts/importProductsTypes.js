require('dotenv').config();
const { ProductsTypes } = require('../models');

const productsTypesList = [
  { id: 1, desc: 'roupa pronta' },
  { id: 2, desc: 'roupa revenda' },
  { id: 3, desc: 'produto' },
  { id: 4, desc: 'roupa sob medida' },
  { id: 5, desc: 'servico' },
];

async function importProductsTypes() {
  try {
    for (const item of productsTypesList) {
      await ProductsTypes.upsert(item);
      console.log(`Importado: ${item.id} - ${item.desc}`);
    }

    console.log('Importacao de tipos de produto finalizada!');
  } catch (error) {
    console.error('Erro ao importar tipos de produto:', error.message);
    process.exitCode = 1;
  } finally {
    await ProductsTypes.sequelize.close();
  }
}

importProductsTypes();
