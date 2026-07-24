const LEGACY_MEASUREMENT_DEFINITIONS = [
  { key: "busto", label: "Busto", sortOrder: 1 },
  { key: "alturaBusto", label: "Altura do busto", sortOrder: 2 },
  { key: "braco", label: "Braco", sortOrder: 3 },
  { key: "cintura", label: "Cintura", sortOrder: 4 },
  { key: "cinturaBaixa", label: "Abaixo da cintura", sortOrder: 5 },
  { key: "cos", label: "Cos", sortOrder: 6 },
  { key: "quadril", label: "Quadril", sortOrder: 7 },
  { key: "costas", label: "Costas", sortOrder: 8 },
  { key: "colete", label: "Colete", sortOrder: 9 },
  { key: "gancho", label: "Gancho", sortOrder: 10 },
  { key: "comprimentoSaia", label: "Comprimento da saia", sortOrder: 11 },
  { key: "comprimentoBlusa", label: "Comprimento da blusa", sortOrder: 12 },
  { key: "comprimentoCalca", label: "Comprimento da calca", sortOrder: 13 },
  { key: "comprimentoManga", label: "Comprimento da manga", sortOrder: 14 },
  { key: "comprimentoVestido", label: "Comprimento do vestido", sortOrder: 15 },
  { key: "comprimentoBermuda", label: "Comprimento da bermuda", sortOrder: 16 },
  { key: "perna", label: "Perna", sortOrder: 17 },
  { key: "coice", label: "Coice", sortOrder: 18 },
];

function removeAccents(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function generateMeasurementKey(label) {
  const cleaned = removeAccents(label)
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());

  if (!cleaned.length) {
    return null;
  }

  return cleaned
    .map((part, index) =>
      index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join("");
}

module.exports = {
  LEGACY_MEASUREMENT_DEFINITIONS,
  generateMeasurementKey,
};
