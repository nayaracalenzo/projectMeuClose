require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { AuditTypes } = require("../models");

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) ? normalized : null;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

async function importAuditTypes() {
  const rows = [];
  const filePath = path.join(__dirname, "tipoAuditoria.csv");

  console.log("Iniciando leitura do CSV de tipos de auditoria...");

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ";" }))
    .on("data", (data) => {
      rows.push(data);
    })
    .on("end", async () => {
      console.log(`Total encontrados no CSV: ${rows.length}`);

      const auditTypesToInsert = [];
      let skipped = 0;

      for (const row of rows) {
        const legacyId = normalizeInteger(row.id);

        try {
          const description = normalizeText(row.des);

          if (!legacyId || !description) {
            skipped += 1;
            continue;
          }

          auditTypesToInsert.push({
            idAuditType: legacyId,
            description,
          });
        } catch (error) {
          console.error(
            `Erro ao processar tipo de auditoria legado ${legacyId || "sem-id"}: ${error.message}`,
          );
          skipped += 1;
        }
      }

      try {
        await AuditTypes.bulkCreate(auditTypesToInsert, {
          validate: true,
          updateOnDuplicate: ["description", "updatedAt"],
        });

        console.log("Importacao de tipos de auditoria finalizada.");
        console.log(`Processados: ${auditTypesToInsert.length}`);
        console.log(`Ignorados: ${skipped}`);
      } catch (error) {
        console.error("Erro geral ao importar tipos de auditoria:", error.message);
      }

      await AuditTypes.sequelize.close();
      process.exit();
    })
    .on("error", async (error) => {
      console.error("Erro ao ler o arquivo de tipos de auditoria:", error.message);
      await AuditTypes.sequelize.close();
      process.exit(1);
    });
}

if (require.main === module) {
  importAuditTypes();
}

module.exports = importAuditTypes;
