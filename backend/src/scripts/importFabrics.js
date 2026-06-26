require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Fabrics } = require('../models');

async function importFabrics() {
  const fabrics = [];
  const filePath = path.join(__dirname, 'tecido.csv');

  const normalizeHeader = (value) =>
    String(value || '')
      .replace(/^\uFEFF/, '')
      .replace(/"/g, '')
      .trim()
      .toLowerCase();

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(
          csv({
            separator: ';',
            mapHeaders: ({ header }) => normalizeHeader(header),
          })
        )
        .on('data', (row) => {
          const id = Number(String(row.id || '').trim());
          const desc = String(row.des || '').trim();

          if (!Number.isNaN(id) && desc) {
            fabrics.push({ id, desc });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    for (const item of fabrics) {
      await Fabrics.upsert(item);
      console.log(`Importado: ${item.id} - ${item.desc}`);
    }

    console.log('Importacao de tecidos finalizada!');
  } catch (error) {
    console.error('Erro ao importar tecidos:', error.message);
    process.exitCode = 1;
  } finally {
    await Fabrics.sequelize.close();
  }
}

importFabrics();
