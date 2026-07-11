require("dotenv").config();
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Audits, AuditTypes, Users } = require("../models");
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

function buildLegacyFingerprint(row) {
  const raw = [
    normalizeText(row.dt) || "",
    normalizeInteger(row.idTipAud) || "",
    normalizeInteger(row.idUsu) || "",
    normalizeText(row.his) || "",
    normalizeText(row.mot) || "",
  ].join("|");

  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function importAudits() {
  const rows = [];
  const filePath = path.join(__dirname, "auditoria.csv");

  console.log("Iniciando leitura do CSV de auditoria...");

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ";" }))
    .on("data", (data) => {
      rows.push(data);
    })
    .on("end", async () => {
      console.log(`Total encontrados no CSV: ${rows.length}`);

      const [auditTypes, users] = await Promise.all([
        AuditTypes.findAll({ attributes: ["idAuditType"], raw: true }),
        Users.findAll({ attributes: ["idUser"], raw: true }),
      ]);

      const validAuditTypeIds = new Set(auditTypes.map((item) => Number(item.idAuditType)));
      const validUserIds = new Set(users.map((item) => Number(item.idUser)));

      const auditsToInsert = [];
      let skipped = 0;

      for (const row of rows) {
        const auditTypeId = normalizeInteger(row.idTipAud);

        try {
          const occurredAt = normalizeLegacyDateTime(row.dt, { dateOnly: true });
          const history = normalizeText(row.his);
          const reason = normalizeText(row.mot);
          const legacyUserId = normalizeInteger(row.idUsu);

          if (!auditTypeId || !validAuditTypeIds.has(auditTypeId)) {
            skipped += 1;
            continue;
          }

          if (!occurredAt || !history) {
            skipped += 1;
            continue;
          }

          auditsToInsert.push({
            auditTypeId,
            userId: legacyUserId && validUserIds.has(legacyUserId) ? legacyUserId : null,
            occurredAt,
            history,
            reason,
            legacyFingerprint: buildLegacyFingerprint(row),
            createdAt: occurredAt,
            updatedAt: occurredAt,
          });
        } catch (error) {
          console.error(
            `Erro ao processar auditoria legado tipo ${auditTypeId || "sem-tipo"}: ${error.message}`,
          );
          skipped += 1;
        }
      }

      try {
        await Audits.bulkCreate(auditsToInsert, {
          validate: true,
          updateOnDuplicate: [
            "auditTypeId",
            "userId",
            "occurredAt",
            "history",
            "reason",
            "updatedAt",
          ],
        });

        await Audits.sequelize.query(`
          SELECT setval(
            pg_get_serial_sequence('"audits"', 'idAudit'),
            COALESCE((SELECT MAX("idAudit") FROM "audits"), 1),
            true
          );
        `);

        console.log("Importacao de auditoria finalizada.");
        console.log(`Processados: ${auditsToInsert.length}`);
        console.log(`Ignorados: ${skipped}`);
      } catch (error) {
        console.error("Erro geral ao importar auditoria:", error.message);
      }

      await Audits.sequelize.close();
      process.exit();
    })
    .on("error", async (error) => {
      console.error("Erro ao ler o arquivo de auditoria:", error.message);
      await Audits.sequelize.close();
      process.exit(1);
    });
}

if (require.main === module) {
  importAudits();
}

module.exports = importAudits;
