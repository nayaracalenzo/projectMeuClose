require('dotenv').config();
const { Roles } = require('../models');

const rolesList = [
  { id: 1, desc: 'Doméstica' },
  { id: 2, desc: 'Vendedora' },
  { id: 3, desc: 'Costureira' },
  { id: 4, desc: 'Acabadeira' },
  { id: 5, desc: 'Modelo' },
  { id: 6, desc: 'Marketing/Publicidade' },
];

async function importRoles() {
  try {
    for (const item of rolesList) {
      await Roles.upsert(item);
      console.log(`Importado: ${item.id} - ${item.desc}`);
    }

    console.log('Importacao de roles finalizada!');
  } catch (error) {
    console.error('Erro ao importar roles:', error.message);
    process.exitCode = 1;
  } finally {
    await Roles.sequelize.close();
  }
}

importRoles();
