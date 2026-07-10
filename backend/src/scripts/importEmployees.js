require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Employees } = require("../models");

const ENABLED_EMPLOYEE_IDS = new Set([19, 32, 59, 191, 225, 226, 228]);
const DEFAULT_DDD = "85";
const DEFAULT_ENABLED_ROLE_ID = 3;
const ROLE_ID_BY_PROFESSION = {
  DOMESTICA: 1,
  VENDEDORA: 2,
  COSTUREIRA: 3,
  ACABADEIRA: 4,
  MODELO: 5,
  "MARKETING/PUBLICIDADE": 6,
};

function getFirstFilled(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;

    const normalized = String(value).trim();
    if (normalized) return normalized;
  }

  return null;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

function normalizeEmail(value) {
  const email = normalizeText(value);
  if (!email) return null;

  if (!email.includes("@")) {
    return null;
  }

  return email.toLowerCase();
}

function normalizeRoleLabel(value) {
  const text = normalizeText(value);
  if (!text) return null;

  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizePhone(value) {
  let digits = normalizeDigits(value);
  if (!digits) return null;

  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (digits.length === 8) {
    return `${DEFAULT_DDD}9${digits}`;
  }

  if (digits.length === 9) {
    return `${DEFAULT_DDD}${digits}`;
  }

  if (digits.length === 10) {
    if (digits.startsWith(DEFAULT_DDD)) {
      return `${DEFAULT_DDD}9${digits.slice(2)}`;
    }

    return `${digits.slice(0, 2)}9${digits.slice(2)}`;
  }

  if (digits.length === 11) {
    return digits;
  }

  return digits.slice(-11);
}

function parseLegacyDate(value) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const datePart = raw.split(" ")[0];
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(datePart);
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

function parseLegacyDateTime(value) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const match =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hours = Number(match[4] || 0);
  const minutes = Number(match[5] || 0);
  const seconds = Number(match[6] || 0);

  const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);

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

function resolveDocument(row) {
  const documentValue = getFirstFilled(row, ["cpf"]);
  return normalizeDigits(documentValue);
}

function resolveRoleId(row) {
  const roleLabel = normalizeRoleLabel(getFirstFilled(row, ["prof", "role", "cargo", "funcao"]));
  if (!roleLabel) return null;

  return ROLE_ID_BY_PROFESSION[roleLabel] || null;
}

function buildUniqueShortName(shortName, legacyId, usedShortNames) {
  const base = normalizeText(shortName);
  if (!base) return null;

  const normalizedBase = base.toUpperCase();
  if (!usedShortNames.has(normalizedBase)) {
    usedShortNames.add(normalizedBase);
    return base;
  }

  const suffix = legacyId ? ` ${legacyId}` : " LEGADO";
  const maxBaseLength = Math.max(1, 60 - suffix.length);
  const candidate = `${base.slice(0, maxBaseLength).trim()}${suffix}`;
  const normalizedCandidate = candidate.toUpperCase();

  usedShortNames.add(normalizedCandidate);
  return candidate;
}

function getEmployeeValidationIssues(employee) {
  const issues = [];

  if (!employee.fullName) {
    issues.push("Nome completo é obrigatório.");
  }

  if (!employee.shortName) {
    issues.push("Nome curto é obrigatório.");
  }

  if (employee.document && employee.document.length !== 11 && employee.document.length !== 14) {
    issues.push("Documento deve conter 11 ou 14 digitos.");
  }

  if (employee.email && !employee.email.includes("@")) {
    issues.push("Email invalido.");
  }

  if (!employee.roleId) {
    issues.push("RoleId é obrigatório.");
  }

  return issues;
}

async function importEmployees() {
  const results = [];
  const filePath = path.join(__dirname, "funcionario.csv");

  console.log("Iniciando leitura do CSV de employees...");

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ";" }))
    .on("data", (data) => {
      results.push(data);
    })
    .on("end", async () => {
      console.log(`Total encontrados no CSV: ${results.length}`);

      const existingEmployees = await Employees.findAll({
        attributes: ["shortName"],
        raw: true,
      });
      const usedShortNames = new Set(
        existingEmployees
          .map((employee) => normalizeText(employee.shortName)?.toUpperCase())
          .filter(Boolean)
      );

      const employeesToInsert = [];
      let skipped = 0;

      for (const row of results) {
        const legacyId = Number(getFirstFilled(row, ["id"]));

        try {
          const resolvedRoleId = resolveRoleId(row);
          const fallbackRoleId =
            resolvedRoleId || (ENABLED_EMPLOYEE_IDS.has(legacyId) ? DEFAULT_ENABLED_ROLE_ID : null);
          const uniqueShortName = buildUniqueShortName(
            getFirstFilled(row, ["nomRed"]),
            legacyId,
            usedShortNames
          );

          const employee = {
            idEmployee: Number.isNaN(legacyId) ? undefined : legacyId,
            fullName: normalizeText(getFirstFilled(row, ["nom"])),
            shortName: uniqueShortName,
            document: resolveDocument(row),
            rg: normalizeText(getFirstFilled(row, ["rg",])),
            zipCode: normalizeDigits(getFirstFilled(row, ["cep"])),
            street: normalizeText(getFirstFilled(row, ["ende"])),
            number: null,
            complement: null,
            neighborhood: normalizeText(getFirstFilled(row, ["bai"])),
            city: normalizeText(getFirstFilled(row, ["mun"])),
            state: normalizeText(getFirstFilled(row, ["uf"]))?.toUpperCase() || null,
            primaryPhone: normalizePhone(getFirstFilled(row, ["cel"])),
            secondaryPhone: normalizePhone(getFirstFilled(row, ["telCom", "telRes"])),
            nameSecPhone: null,
            email: normalizeEmail(getFirstFilled(row, ["ema"])),
            comment: normalizeText(getFirstFilled(row, ["obs"])),
            birthDate: parseLegacyDate(getFirstFilled(row, ["datNas"])),
            roleId: fallbackRoleId,
            bankData: null,
            active: getFirstFilled(row, ["ina"]) === "1" ? false : true,
            dsbl: !ENABLED_EMPLOYEE_IDS.has(legacyId),
            createdAt:
              parseLegacyDateTime(getFirstFilled(row, ["datCad"])) ||
              new Date(),
            updatedAt: new Date(),
          };

          const issues = getEmployeeValidationIssues(employee);

          if (issues.length > 0) {
            console.warn(
              `Ignorando employee legado ${legacyId || employee.shortName || "sem-id"}: ${issues[0]}`
            );
            skipped += 1;
            continue;
          }

          employeesToInsert.push(employee);
        } catch (error) {
          console.error(
            `Erro ao processar employee ${legacyId || row.short_name || row.nomCur || "sem-id"}:`,
            error.message
          );
          skipped += 1;
        }
      }

      try {
        console.log("Inserindo employees no banco...");

        await Employees.bulkCreate(employeesToInsert, {
          validate: true,
          ignoreDuplicates: true,
        });

        console.log("Importacao de employees finalizada.");
        console.log(`Inseridos: ${employeesToInsert.length}`);
        console.log(`Ignorados: ${skipped}`);
      } catch (error) {
        console.error("Erro geral ao inserir employees:", error.message);
      }

      process.exit();
    })
    .on("error", (error) => {
      console.error("Erro ao ler o arquivo de employees:", error.message);
    });
}

importEmployees();
