const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

function resolveLegacySourceDir(options = {}) {
  return (
    options.sourceDir ||
    process.env.LEGACY_IMPORT_SOURCE_DIR ||
    __dirname
  );
}

function resolveLegacyImportFilePath(fileName, options = {}) {
  return path.join(resolveLegacySourceDir(options), fileName);
}

function legacyImportFileExists(fileName, options = {}) {
  return fs.existsSync(resolveLegacyImportFilePath(fileName, options));
}

async function readLegacyCsvRows(fileName, options = {}) {
  const filePath = resolveLegacyImportFilePath(fileName, options);
  const rows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ separator: ";" }))
      .on("data", (row) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  return rows;
}

module.exports = {
  legacyImportFileExists,
  readLegacyCsvRows,
  resolveLegacyImportFilePath,
  resolveLegacySourceDir,
};
