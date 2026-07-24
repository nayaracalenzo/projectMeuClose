require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  Categories,
  ClothingsType,
  Colors,
  Customers,
  Employees,
  Fabrics,
  FinancialCategories,
  PaymentTypes,
  Products,
  ProductsTypes,
  ReceivableInstallments,
  Receivables,
  SaleItems,
  Sales,
  Sizes,
  Status,
  Suppliers,
  Users,
  Payables,
  PayablePayments,
  CashEntries,
  BankEntries,
  PaymentReceipts,
  sequelize,
} = require("../models");
const {
  legacyImportFileExists,
  readLegacyCsvRows,
  resolveLegacySourceDir,
} = require("./legacyImportSource");

const FILES = {
  products: {
    fileName: "produto.csv",
    scriptName: "importProducts.js",
    headers: ["id", "idCli", "idFunc", "idSit", "idTipRou", "idTipPro", "idCor", "idTec", "idTam", "des", "det", "dtPro", "pre", "pgCos"],
  },
  sales: {
    fileName: "venda.csv",
    scriptName: "importSales.js",
    headers: ["id", "idCli", "idUsu", "dt", "totVen", "vlrVis", "vlrPra", "idTipDocVis", "idTipDocPra"],
  },
  saleItems: {
    fileName: "itensVenda.csv",
    scriptName: "importSaleItems.js",
    headers: ["id", "idVen", "idPro", "qtd", "valUni", "valTot"],
  },
  receivables: {
    fileName: "contaRec.csv",
    scriptName: "importReceivables.js",
    headers: ["id", "idCli", "idPor", "idCon", "idTipDoc", "numDoc", "his", "dtEmi", "dtVen", "vlr", "vlrRec", "dtRec"],
  },
  payables: {
    fileName: "contaPag.csv",
    scriptName: "importPayables.js",
    headers: ["id", "idCon", "idFor", "idTipDoc", "numDoc", "his", "dtEmi", "dtVen", "vlr", "vlrPag", "dtPag"],
  },
  cashEntries: {
    fileName: "livroCaixa.csv",
    scriptName: "importCashEntries.js",
    headers: ["id", "idCon", "idTipDoc", "dt", "num", "his", "ent", "sai"],
  },
  bankEntries: {
    fileName: "lancamentoBancos.csv",
    scriptName: "importBankEntries.js",
    headers: ["id", "idCon", "dt", "num", "his", "ent", "sai"],
  },
};

const STEP_ORDER = [
  "products",
  "sales",
  "saleItems",
  "receivables",
  "payables",
  "cashEntries",
  "bankEntries",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    sourceDir: null,
    dryRun: false,
    reportPath: null,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg.startsWith("--sourceDir=")) {
      parsed.sourceDir = arg.slice("--sourceDir=".length).trim();
      continue;
    }

    if (arg.startsWith("--reportPath=")) {
      parsed.reportPath = arg.slice("--reportPath=".length).trim();
    }
  }

  return parsed;
}

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) ? normalized : null;
}

function parseHeader(filePath) {
  const buffer = fs.readFileSync(filePath, "utf8");
  const [line = ""] = buffer.split(/\r?\n/, 1);
  return line
    .split(";")
    .map((item) => item.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
}

function ensureDirectory(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

function defaultReportPath(sourceDir) {
  return path.join(
    sourceDir,
    `legacy-import-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
}

function addIssue(issues, severity, scope, message, meta = {}) {
  issues.push({
    severity,
    scope,
    message,
    ...meta,
  });
}

function buildIdSet(rows, idKey) {
  return new Set(rows.map((row) => Number(row[idKey])).filter(Boolean));
}

async function collectReferenceSets() {
  const [
    customers,
    employees,
    suppliers,
    financialCategories,
    paymentTypes,
    statuses,
    categories,
    productTypes,
    clothingTypes,
    colors,
    fabrics,
    sizes,
    users,
    products,
    sales,
    saleItems,
    receivables,
    installments,
    payables,
    payablePayments,
    cashEntries,
    bankEntries,
    paymentReceipts,
  ] = await Promise.all([
    Customers.findAll({ attributes: ["idCustomer"], raw: true }),
    Employees.findAll({ attributes: ["idEmployee"], raw: true }),
    Suppliers.findAll({ attributes: ["idSupplier"], raw: true }),
    FinancialCategories.findAll({ attributes: ["idFinancialCategory"], raw: true }),
    PaymentTypes.findAll({ attributes: ["idPaymentType"], raw: true }),
    Status.findAll({ attributes: ["id"], raw: true }),
    Categories.findAll({ attributes: ["id"], raw: true }),
    ProductsTypes.findAll({ attributes: ["id"], raw: true }),
    ClothingsType.findAll({ attributes: ["id"], raw: true }),
    Colors.findAll({ attributes: ["id"], raw: true }),
    Fabrics.findAll({ attributes: ["id"], raw: true }),
    Sizes.findAll({ attributes: ["id"], raw: true }),
    Users.findAll({ attributes: ["idUser"], raw: true }),
    Products.findAll({ attributes: ["id"], raw: true }),
    Sales.findAll({ attributes: ["idSale"], raw: true }),
    SaleItems.findAll({ attributes: ["idSaleItem"], raw: true }),
    Receivables.findAll({ attributes: ["idReceivable"], raw: true }),
    ReceivableInstallments.findAll({ attributes: ["idReceivableInstallment"], raw: true }),
    Payables.findAll({ attributes: ["idPayable"], raw: true }),
    PayablePayments.findAll({ attributes: ["idPayablePayment"], raw: true }),
    CashEntries.findAll({ attributes: ["idCashEntry"], raw: true }),
    BankEntries.findAll({ attributes: ["idBankEntry"], raw: true }),
    PaymentReceipts.findAll({ attributes: ["idPaymentReceipt"], raw: true }),
  ]);

  return {
    customers: buildIdSet(customers, "idCustomer"),
    employees: buildIdSet(employees, "idEmployee"),
    suppliers: buildIdSet(suppliers, "idSupplier"),
    financialCategories: buildIdSet(financialCategories, "idFinancialCategory"),
    paymentTypes: buildIdSet(paymentTypes, "idPaymentType"),
    statuses: buildIdSet(statuses, "id"),
    categories: buildIdSet(categories, "id"),
    productTypes: buildIdSet(productTypes, "id"),
    clothingTypes: buildIdSet(clothingTypes, "id"),
    colors: buildIdSet(colors, "id"),
    fabrics: buildIdSet(fabrics, "id"),
    sizes: buildIdSet(sizes, "id"),
    users: buildIdSet(users, "idUser"),
    products: buildIdSet(products, "id"),
    sales: buildIdSet(sales, "idSale"),
    saleItems: buildIdSet(saleItems, "idSaleItem"),
    receivables: buildIdSet(receivables, "idReceivable"),
    receivableInstallments: buildIdSet(installments, "idReceivableInstallment"),
    payables: buildIdSet(payables, "idPayable"),
    payablePayments: buildIdSet(payablePayments, "idPayablePayment"),
    cashEntries: buildIdSet(cashEntries, "idCashEntry"),
    bankEntries: buildIdSet(bankEntries, "idBankEntry"),
    paymentReceipts: buildIdSet(paymentReceipts, "idPaymentReceipt"),
  };
}

async function buildSnapshot() {
  const snapshot = {};
  const tables = [
    ["sales", Sales, "idSale"],
    ["saleItems", SaleItems, "idSaleItem"],
    ["products", Products, "id"],
    ["receivables", Receivables, "idReceivable"],
    ["receivableInstallments", ReceivableInstallments, "idReceivableInstallment"],
    ["paymentReceipts", PaymentReceipts, "idPaymentReceipt"],
    ["payables", Payables, "idPayable"],
    ["payablePayments", PayablePayments, "idPayablePayment"],
    ["cashEntries", CashEntries, "idCashEntry"],
    ["bankEntries", BankEntries, "idBankEntry"],
  ];

  for (const [key, model, pk] of tables) {
    snapshot[key] = {
      count: await model.count(),
      maxId: Number((await model.max(pk)) || 0),
    };
  }

  return snapshot;
}

function validateHeaders(fileKey, filePath, issues) {
  const expectedHeaders = FILES[fileKey].headers;
  const actualHeaders = parseHeader(filePath);
  const missing = expectedHeaders.filter((header) => !actualHeaders.includes(header));

  if (missing.length) {
    addIssue(
      issues,
      "error",
      fileKey,
      `Cabecalho invalido em ${FILES[fileKey].fileName}. Colunas ausentes: ${missing.join(", ")}`,
      { fileName: FILES[fileKey].fileName },
    );
  }
}

function classifyRows(rows, idParser, existingIds) {
  let inserts = 0;
  let updates = 0;
  const duplicates = new Set();
  const seenInFile = new Set();

  rows.forEach((row) => {
    const id = idParser(row);
    if (!id) return;

    if (seenInFile.has(id)) {
      duplicates.add(id);
      return;
    }

    seenInFile.add(id);
    if (existingIds.has(id)) {
      updates += 1;
    } else {
      inserts += 1;
    }
  });

  return {
    inserts,
    updates,
    duplicateIdsInFile: [...duplicates],
  };
}

function validateMembership(value, set, label, rowId, fileKey, issues, rowRef) {
  if (!value) return;
  if (set.has(value)) return;
  addIssue(
    issues,
    "error",
    fileKey,
    `${label} ${value} nao existe para o registro ${rowId}.`,
    { rowRef },
  );
}

function validateMembershipWarning(value, set, label, rowId, fileKey, issues, rowRef) {
  if (!value) return;
  if (set.has(value)) return;
  addIssue(
    issues,
    "warning",
    fileKey,
    `${label} ${value} nao existe para o registro ${rowId}. O registro sera ignorado ou normalizado na importacao.`,
    { rowRef },
  );
}

function validateProducts(rows, refs, lotSets, issues) {
  rows.forEach((row) => {
    const rowId = normalizeInteger(row.id) || "sem-id";
    validateMembershipWarning(normalizeInteger(row.idCli), refs.customers, "Cliente", rowId, "products", issues, row);
    validateMembership(normalizeInteger(row.idSit), refs.statuses, "Status", rowId, "products", issues, row);
    validateMembershipWarning(normalizeInteger(row.idTipRou), refs.clothingTypes, "Tipo de roupa", rowId, "products", issues, row);
    validateMembership(normalizeInteger(row.idTipPro), refs.productTypes, "Tipo de produto", rowId, "products", issues, row);
    validateMembership(normalizeInteger(row.idCor), refs.colors, "Cor", rowId, "products", issues, row);
    validateMembershipWarning(normalizeInteger(row.idTec), refs.fabrics, "Tecido", rowId, "products", issues, row);
    validateMembership(normalizeInteger(row.idTam), refs.sizes, "Tamanho", rowId, "products", issues, row);
  });

  rows.forEach((row) => {
    const id = normalizeInteger(row.id);
    if (id) lotSets.products.add(id);
  });
}

function validateSales(rows, refs, lotSets, issues) {
  rows.forEach((row) => {
    const rowId = normalizeInteger(row.id) || "sem-id";
    validateMembershipWarning(normalizeInteger(row.idCli), refs.customers, "Cliente", rowId, "sales", issues, row);
    validateMembership(normalizeInteger(row.idTipDocVis), refs.paymentTypes, "Forma de pagamento a vista", rowId, "sales", issues, row);
    validateMembership(normalizeInteger(row.idTipDocPra), refs.paymentTypes, "Forma de pagamento a prazo", rowId, "sales", issues, row);
  });

  rows.forEach((row) => {
    const id = normalizeInteger(row.id);
    if (id) lotSets.sales.add(id);
  });
}

function validateSaleItems(rows, refs, lotSets, issues) {
  rows.forEach((row) => {
    const rowId = normalizeInteger(row.id) || "sem-id";
    const saleId = normalizeInteger(row.idVen);
    const productId = normalizeInteger(row.idPro);

    if (saleId && !refs.sales.has(saleId) && !lotSets.sales.has(saleId)) {
      addIssue(issues, "error", "saleItems", `Venda ${saleId} nao existe para o item ${rowId}.`, { rowRef: row });
    }

    if (productId && !refs.products.has(productId) && !lotSets.products.has(productId)) {
      addIssue(issues, "error", "saleItems", `Produto ${productId} nao existe para o item ${rowId}.`, { rowRef: row });
    }
  });
}

function validateReceivables(rows, refs, issues) {
  rows.forEach((row) => {
    const rowId = normalizeInteger(row.id) || "sem-id";
    validateMembership(normalizeInteger(row.idCli), refs.customers, "Cliente", rowId, "receivables", issues, row);
    validateMembership(normalizeInteger(row.idCon), refs.financialCategories, "Categoria financeira", rowId, "receivables", issues, row);
    validateMembership(normalizeInteger(row.idTipDoc), refs.paymentTypes, "Forma de pagamento", rowId, "receivables", issues, row);
  });
}

function validatePayables(rows, refs, issues) {
  rows.forEach((row) => {
    const rowId = normalizeInteger(row.id) || "sem-id";
    validateMembership(normalizeInteger(row.idCon), refs.financialCategories, "Categoria financeira", rowId, "payables", issues, row);
    validateMembership(normalizeInteger(row.idTipDoc), refs.paymentTypes, "Forma de pagamento", rowId, "payables", issues, row);
  });
}

function validateCashEntries(rows, refs, issues) {
  rows.forEach((row) => {
    const rowId = normalizeInteger(row.id) || "sem-id";
    validateMembershipWarning(normalizeInteger(row.idCon), refs.financialCategories, "Categoria financeira", rowId, "cashEntries", issues, row);
    validateMembership(normalizeInteger(row.idTipDoc), refs.paymentTypes, "Forma de pagamento", rowId, "cashEntries", issues, row);
  });
}

function validateBankEntries(rows, refs, issues) {
  rows.forEach((row) => {
    const rowId = normalizeInteger(row.id) || "sem-id";
    validateMembership(normalizeInteger(row.idCon), refs.financialCategories, "Categoria financeira", rowId, "bankEntries", issues, row);
  });
}

function runImportStep(fileKey, sourceDir) {
  const scriptPath = path.join(__dirname, FILES[fileKey].scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: path.join(__dirname, "..", ".."),
    env: {
      ...process.env,
      LEGACY_IMPORT_SOURCE_DIR: sourceDir,
    },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
  });

  return {
    fileKey,
    scriptName: FILES[fileKey].scriptName,
    exitCode: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error
      ? {
          message: result.error.message,
          code: result.error.code || null,
        }
      : null,
  };
}

async function main() {
  const { sourceDir, dryRun, reportPath } = parseArgs();
  const resolvedSourceDir = resolveLegacySourceDir({ sourceDir });
  const resolvedReportPath = reportPath || defaultReportPath(resolvedSourceDir);

  const report = {
    sourceDir: resolvedSourceDir,
    dryRun,
    startedAt: new Date().toISOString(),
    files: {},
    issues: [],
    executedSteps: [],
    snapshotBefore: null,
    snapshotAfter: null,
  };

  try {
    if (!fs.existsSync(resolvedSourceDir)) {
      throw new Error(`Pasta do lote nao encontrada: ${resolvedSourceDir}`);
    }

    const activeFileKeys = STEP_ORDER.filter((key) =>
      legacyImportFileExists(FILES[key].fileName, { sourceDir: resolvedSourceDir }),
    );

    if (!activeFileKeys.length) {
      throw new Error("Nenhum arquivo de lote reconhecido foi encontrado na pasta informada.");
    }

    const refs = await collectReferenceSets();
    const lotSets = {
      products: new Set(),
      sales: new Set(),
    };

    for (const fileKey of activeFileKeys) {
      const filePath = path.join(resolvedSourceDir, FILES[fileKey].fileName);
      validateHeaders(fileKey, filePath, report.issues);
      const rows = await readLegacyCsvRows(FILES[fileKey].fileName, { sourceDir: resolvedSourceDir });

      const existingIds = {
        products: refs.products,
        sales: refs.sales,
        saleItems: refs.saleItems,
        receivables: refs.receivables,
        payables: refs.payables,
        cashEntries: refs.cashEntries,
        bankEntries: refs.bankEntries,
      };

      const classification = classifyRows(
        rows,
        (row) => normalizeInteger(row.id),
        existingIds[fileKey] || new Set(),
      );

      report.files[fileKey] = {
        fileName: FILES[fileKey].fileName,
        totalRows: rows.length,
        inserts: classification.inserts,
        updates: classification.updates,
        duplicateIdsInFile: classification.duplicateIdsInFile,
      };

      if (classification.duplicateIdsInFile.length) {
        addIssue(
          report.issues,
          "error",
          fileKey,
          `IDs duplicados no arquivo ${FILES[fileKey].fileName}: ${classification.duplicateIdsInFile.join(", ")}`,
        );
      }

      if (fileKey === "products") {
        validateProducts(rows, refs, lotSets, report.issues);
      }
      if (fileKey === "sales") {
        validateSales(rows, refs, lotSets, report.issues);
      }
      if (fileKey === "saleItems") {
        validateSaleItems(rows, refs, lotSets, report.issues);
      }
      if (fileKey === "receivables") {
        validateReceivables(rows, refs, report.issues);
      }
      if (fileKey === "payables") {
        validatePayables(rows, refs, report.issues);
      }
      if (fileKey === "cashEntries") {
        validateCashEntries(rows, refs, report.issues);
      }
      if (fileKey === "bankEntries") {
        validateBankEntries(rows, refs, report.issues);
      }
    }

    report.snapshotBefore = await buildSnapshot();

    const blockingIssues = report.issues.filter((issue) => issue.severity === "error");

    if (dryRun || blockingIssues.length) {
      report.finishedAt = new Date().toISOString();
      report.status = blockingIssues.length ? "blocked" : "dry-run-ok";
      ensureDirectory(resolvedReportPath);
      fs.writeFileSync(resolvedReportPath, JSON.stringify(report, null, 2), "utf8");
      console.log(`Relatorio salvo em ${resolvedReportPath}`);
      console.log(`Arquivos analisados: ${activeFileKeys.length}`);
      console.log(`Erros bloqueantes: ${blockingIssues.length}`);
      return;
    }

    for (const fileKey of activeFileKeys) {
      const stepResult = runImportStep(fileKey, resolvedSourceDir);
      report.executedSteps.push(stepResult);

      if (stepResult.exitCode !== 0) {
        throw new Error(
          `Falha ao executar ${FILES[fileKey].scriptName}. Consulte o relatorio para detalhes.`,
        );
      }
    }

    report.snapshotAfter = await buildSnapshot();
    report.finishedAt = new Date().toISOString();
    report.status = "completed";
    ensureDirectory(resolvedReportPath);
    fs.writeFileSync(resolvedReportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`Importacao incremental concluida. Relatorio salvo em ${resolvedReportPath}`);
  } catch (error) {
    report.finishedAt = new Date().toISOString();
    report.status = "failed";
    addIssue(report.issues, "error", "orchestrator", error.message);
    ensureDirectory(resolvedReportPath);
    fs.writeFileSync(resolvedReportPath, JSON.stringify(report, null, 2), "utf8");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
