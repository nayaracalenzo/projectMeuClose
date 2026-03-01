require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Professions } = require('../models');

async function importProfession() {
  const results = [];

  const filePath = path.join(__dirname, 'profissao.csv');
  console.log('Lendo arquivo em:', filePath);

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ';' }))
    .on('data', (data) => {
      results.push(data);
    })
    .on('end', async () => {
      console.log(`Total encontrados: ${results.length}`);

      for (const row of results) {
        try {
          await Professions.create({
            idProfession: row.id,
            nameProfession: row.des,
          });

          console.log(`Importado: ${row.id || row.des}`);
        } catch (error) {
          console.error(`Erro ao importar ${row.des}:`, error.message);
        }
      }

      console.log('Importação finalizada!');
      process.exit();
    });
}

importProfession();