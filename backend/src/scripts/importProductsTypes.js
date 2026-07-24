require('dotenv').config();
const { ProductsTypes } = require('../models');

const productsTypesList = [
  { id: 1, desc: 'Roupa Pronta' },
  { id: 2, desc: 'Roupa Revenda' },
  { id: 3, desc: 'Produto' },
  { id: 4, desc: 'Roupa Sob Medida' },
  { id: 5, desc: 'Serviço' },
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
