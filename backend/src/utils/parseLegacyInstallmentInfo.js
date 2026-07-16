function normalizeCandidate(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function extractInstallmentInfo(candidate) {
  const normalized = normalizeCandidate(candidate);
  if (!normalized) return null;

  const match = normalized.match(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/);
  if (!match) return null;

  const installmentNumber = Number(match[1]);
  const totalInstallments = Number(match[2]);

  if (
    !Number.isInteger(installmentNumber) ||
    !Number.isInteger(totalInstallments) ||
    installmentNumber <= 0 ||
    totalInstallments <= 0 ||
    installmentNumber > totalInstallments
  ) {
    return null;
  }

  return {
    installmentNumber,
    totalInstallments,
  };
}

function parseLegacyInstallmentInfo(...candidates) {
  for (const candidate of candidates) {
    const installmentInfo = extractInstallmentInfo(candidate);
    if (installmentInfo) {
      return installmentInfo;
    }
  }

  return {
    installmentNumber: 1,
    totalInstallments: 1,
  };
}

module.exports = {
  parseLegacyInstallmentInfo,
};
