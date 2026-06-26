require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Colors } = require('../models');

async function importColors() {
  const colors = [];
  const filePath = path.join(__dirname, 'color.csv');

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
            colors.push({ id, desc });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    for (const item of colors) {
      await Colors.upsert(item);
      console.log(`Importado: ${item.id} - ${item.desc}`);
    }

    console.log('Importacao de cores finalizada!');
  } catch (error) {
    console.error('Erro ao importar cores:', error.message);
    process.exitCode = 1;
  } finally {
    await Colors.sequelize.close();
  }
}

importColors();
