require('dotenv').config();
const { Roles } = require('../models');

const rolesList = [
  { id: 1, desc: 'Doméstica', active: true },
  { id: 2, desc: 'Vendedora', active: true },
  { id: 3, desc: 'Costureira', active: true },
  { id: 4, desc: 'Acabadeira', active: true },
  { id: 5, desc: 'Modelo', active: true },
  { id: 6, desc: 'Marketing/Publicidade', active: true },
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
