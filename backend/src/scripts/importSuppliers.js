require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Suppliers } = require("../models");
const { normalizeLegacyDateTime } = require("../utils/normalizeLegacyDateTime");

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

function normalizeDocument(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const digitsOnly = normalized.replace(/\D/g, "");
  return digitsOnly || normalized;
}

function normalizePhone(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const digitsOnly = normalized.replace(/\D/g, "");
  return digitsOnly || normalized;
}

function normalizeZipCode(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const digitsOnly = normalized.replace(/\D/g, "");
  return digitsOnly ? digitsOnly.slice(0, 8) : null;
}

function normalizeState(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return normalized.toUpperCase().slice(0, 2);
}

async function importSuppliers() {
  const results = [];
  const filePath = path.join(__dirname, "fornecedor.csv");

  console.log("Iniciando leitura do CSV de fornecedores...");

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ";" }))
    .on("data", (data) => {
      results.push(data);
    })
    .on("end", async () => {
      console.log(`Total encontrados em fornecedor.csv: ${results.length}`);

      const suppliersToInsert = [];
      let skipped = 0;

      for (const row of results) {
        try {
          const supplierId = normalizeInteger(row.id);
          const fullName = normalizeText(row.nom);

          if (!supplierId || !fullName) {
            skipped += 1;
            continue;
          }

          const createdAt = normalizeLegacyDateTime(row.datCad, { dateOnly: true }) || new Date();

          suppliersToInsert.push({
            idSupplier: supplierId,
            fullName,
            tradeName: normalizeText(row.nomFan),
            contactName: normalizeText(row.cont),
            document: normalizeDocument(row.cpf),
            rg: normalizeDocument(row.rg),
            street: normalizeText(row.ende),
            neighborhood: normalizeText(row.bai),
            city: normalizeText(row.mun),
            state: normalizeState(row.uf),
            zipCode: normalizeZipCode(row.cep),
            phoneCommercial1: normalizePhone(row.telCom1),
            phoneCommercial2: normalizePhone(row.telCom2),
            fax: normalizePhone(row.fax),
            phoneMobile: normalizePhone(row.cel),
            email: normalizeText(row.ema),
            comment: normalizeText(row.obs),
            active: row.ina === "1" ? false : true,
            blocked: row.blo === "1" ? true : false,
            createdAt,
            updatedAt: new Date(),
          });
        } catch (error) {
          console.error(
            `Erro ao processar fornecedor legado ${row.id || "sem-id"}: ${error.message}`,
          );
          skipped += 1;
        }
      }

      try {
        await Suppliers.bulkCreate(suppliersToInsert, {
          validate: true,
          updateOnDuplicate: [
            "fullName",
            "tradeName",
            "contactName",
            "document",
            "rg",
            "street",
            "neighborhood",
            "city",
            "state",
            "zipCode",
            "phoneCommercial1",
            "phoneCommercial2",
            "fax",
            "phoneMobile",
            "email",
            "comment",
            "active",
            "blocked",
            "updatedAt",
          ],
        });

        await Suppliers.sequelize.query(`
          SELECT setval(
            pg_get_serial_sequence('"suppliers"', 'idSupplier'),
            COALESCE((SELECT MAX("idSupplier") FROM "suppliers"), 1),
            true
          );
        `);

        console.log("Importacao de fornecedores finalizada.");
        console.log(`Inseridos/atualizados: ${suppliersToInsert.length}`);
        console.log(`Ignorados: ${skipped}`);
      } catch (error) {
        console.error("Erro geral ao importar fornecedores:", error.message);
        process.exitCode = 1;
      } finally {
        await Suppliers.sequelize.close();
      }
    })
    .on("error", async (error) => {
      console.error("Erro ao ler fornecedor.csv:", error.message);
      process.exitCode = 1;
      await Suppliers.sequelize.close();
    });
}

importSuppliers();
