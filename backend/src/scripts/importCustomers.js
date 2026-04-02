require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Customers } = require('../models');
const parseDate = require("../utils/parseDate");

async function importCustomers() {
  const results = [];
  const filePath = path.join(__dirname, 'cliente.csv');

  console.log('Iniciando leitura do CSV...');

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ';' }))
    .on('data', (data) => {
      results.push(data);
    })
    .on('end', async () => {
      console.log(`📊 Total encontrados no CSV: ${results.length}`);

      const customersToInsert = [];
      let skipped = 0;

      for (const row of results) {
        try {
          const cleanDocument = row.cpf?.replace(/\D/g, '');

         

          customersToInsert.push({
            idCustomer: row.id ? Number(row.id) : undefined,
            typeCustomer: cleanDocument.length === 14 ? 'COMPANY' : 'INDIVIDUAL',
            document: cleanDocument || null,
            rg: row.rg || null,
            fullName: row.nom || null,
            companyName: null,
            tradeName: row.nomFan || null,
            phone: row.telRes || '',
            email: row.ema || null,
            zipCode: row.cep
              ? row.cep.replace(/\D/g, '').slice(0, 8)
              : null,
            street: row.ende || null,
            number: row.num || null,
            complement: null,
            city: row.mun || null,
            state: row.uf || null,
            active: row.ina === "1" ? false : true,
            blocked: row.blo === "1" ? true : false,
            professionId: row.idPro ? Number(row.idPro) : null,
            comment: row.obs || null,
            createdAt: parseDate(row.datCad) || new Date(),
            updatedAt: new Date(),
          });

        } catch (error) {
          console.error(`❌ Erro ao processar ${row.cpf}:`, error.message);
          skipped++;
        }
      }

      try {
        console.log('💾 Inserindo no banco...');

        await Customers.bulkCreate(customersToInsert, {
          validate: true,
          ignoreDuplicates: true
        });

        console.log('✅ Importação finalizada!');
        console.log(`✔ Inseridos: ${customersToInsert.length}`);
        console.log(`⚠ Ignorados: ${skipped}`);

      } catch (error) {
        console.error('❌ Erro geral ao inserir:', error.message);
      }

      process.exit();
    })
    .on('error', (error) => {
      console.error('❌ Erro ao ler o arquivo:', error.message);
    });
}

importCustomers();