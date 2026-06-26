require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { ClothingsType } = require("../models");

async function importClothingsType() {
  const results = [];
  const filePath = path.join(__dirname, "tipoRoupa.csv");

  console.log("Iniciando leitura do CSV...");

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ";" }))
    .on("data", (data) => {
      results.push(data);
    })
    .on("end", async () => {
      console.log(`Total encontrados no CSV: ${results.length}`);

      let inserted = 0;
      let skipped = 0;

      for (const row of results) {
        try {
          const id = row.id ? Number(row.id) : undefined;
          const desc = row.desc || row.des || row.nome || row.name;

          if (!desc) {
            console.warn(`Ignorando linha sem descricao: ${JSON.stringify(row)}`);
            skipped += 1;
            continue;
          }

          await ClothingsType.upsert({
            id,
            desc: String(desc).trim().toLowerCase(),
          });

          inserted += 1;
          console.log(`Importado: ${id || "auto"} - ${String(desc).trim().toLowerCase()}`);
        } catch (error) {
          console.error(`Erro ao importar linha ${JSON.stringify(row)}:`, error.message);
          skipped += 1;
        }
      }

      console.log("Importacao finalizada.");
      console.log(`Processados com sucesso: ${inserted}`);
      console.log(`Ignorados: ${skipped}`);

      await ClothingsType.sequelize.close();
      process.exit();
    })
    .on("error", async (error) => {
      console.error("Erro ao ler o arquivo:", error.message);
      await ClothingsType.sequelize.close();
      process.exit(1);
    });
}

importClothingsType();
