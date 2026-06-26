require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Customers } = require("../models");
const parseDate = require("../utils/parseDate");
const {
  getClientValidationIssues,
  normalizeClientInput,
} = require("../utils/clientValidation");

function parseLegacyBirthDate(dateString) {
  if (!dateString) return null;

  const raw = String(dateString).trim();
  if (!raw) return null;

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

async function importCustomers() {
  const results = [];
  const filePath = path.join(__dirname, "cliente.csv");

  console.log("Iniciando leitura do CSV...");

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ";" }))
    .on("data", (data) => {
      results.push(data);
    })
    .on("end", async () => {
      console.log(`Total encontrados no CSV: ${results.length}`);

      const customersToInsert = [];
      let skipped = 0;

      for (const row of results) {
        try {
          const cleanDocument = row.cpf?.replace(/\D/g, "") || "";
          const typeCustomer = cleanDocument.length === 14 ? "COMPANY" : "INDIVIDUAL";

          const draftCustomer = {
            idCustomer: row.id ? Number(row.id) : undefined,
            typeCustomer,
            document: cleanDocument || null,
            rg: row.rg || null,
            fullName: typeCustomer === "INDIVIDUAL" ? row.nom || null : null,
            birthDate: parseLegacyBirthDate(row.datNas),
            companyName:
              typeCustomer === "COMPANY" ? row.nomFan || row.nom || null : null,
            tradeName: row.nomFan || null,
            phone: row.telRes || "",
            email: row.ema || null,
            zipCode: row.cep ? row.cep.replace(/\D/g, "").slice(0, 8) : null,
            street: row.ende || null,
            number: row.num || null,
            complement: null,
            neighborhood: row.bai || null,
            city: row.mun || null,
            state: row.uf || null,
            active: row.ina === "1" ? false : true,
            blocked: row.blo === "1" ? true : false,
            professionId: row.idPro ? Number(row.idPro) : null,
            comment: row.obs || null,
            createdAt: parseDate(row.datCad) || new Date(),
            updatedAt: new Date(),
          };

          const normalizedCustomer = normalizeClientInput(draftCustomer);
          const issues = getClientValidationIssues(normalizedCustomer);

          if (issues.length > 0) {
            console.warn(
              `Ignorando cliente legado ${row.id || row.cpf || "sem-id"}: ${issues[0]}`
            );
            skipped += 1;
            continue;
          }

          customersToInsert.push({
            ...draftCustomer,
            document: normalizedCustomer.document,
            rg: normalizedCustomer.rg,
            fullName: normalizedCustomer.fullName,
            birthDate: normalizedCustomer.birthDate,
            companyName: normalizedCustomer.companyName,
            tradeName: normalizedCustomer.tradeName,
            phone: normalizedCustomer.phone,
            email: normalizedCustomer.email,
            zipCode: normalizedCustomer.zipCode,
            street: normalizedCustomer.street,
            number: normalizedCustomer.number,
            complement: normalizedCustomer.complement,
            neighborhood: normalizedCustomer.neighborhood,
            city: normalizedCustomer.city,
            state: normalizedCustomer.state,
            comment: normalizedCustomer.comment,
          });
        } catch (error) {
          console.error(`Erro ao processar ${row.cpf}:`, error.message);
          skipped += 1;
        }
      }

      try {
        console.log("Inserindo no banco...");

        await Customers.bulkCreate(customersToInsert, {
          validate: true,
          ignoreDuplicates: true,
        });

        console.log("Importacao finalizada.");
        console.log(`Inseridos: ${customersToInsert.length}`);
        console.log(`Ignorados: ${skipped}`);
      } catch (error) {
        console.error("Erro geral ao inserir:", error.message);
      }

      process.exit();
    })
    .on("error", (error) => {
      console.error("Erro ao ler o arquivo:", error.message);
    });
}

importCustomers();
