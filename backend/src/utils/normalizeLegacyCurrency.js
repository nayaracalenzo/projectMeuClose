function normalizeLegacyCurrency(value) {
  if (value === undefined || value === null || value === "") return null;

  const normalizedText = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!normalizedText) return null;

  const normalized = Number(normalizedText);
  if (!Number.isFinite(normalized)) return null;

  return Number(normalized.toFixed(2));
}

module.exports = {
  normalizeLegacyCurrency,
};
