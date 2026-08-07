function normalizeDateToLocalMidnight(value) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const datePart = raw.includes("T") ? raw.split("T")[0] : raw.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function expandTwoDigitYear(year) {
  return 2000 + Number(year);
}

function normalizeShortOrIsoDateToIso(value) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const isoPart = raw.includes("T") ? raw.split("T")[0] : raw;
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoPart);

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const shortMatch = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(raw);
  if (shortMatch) {
    const day = Number(shortMatch[1]);
    const month = Number(shortMatch[2]);
    const year = expandTwoDigitYear(shortMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const longMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (longMatch) {
    const day = Number(longMatch[1]);
    const month = Number(longMatch[2]);
    const year = Number(longMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

module.exports = {
  normalizeShortOrIsoDateToIso,
  normalizeDateToLocalMidnight,
};
