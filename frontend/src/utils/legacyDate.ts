function pad(value: number) {
  return String(value).padStart(2, "0");
}

function expandTwoDigitYear(year: number) {
  return 2000 + year;
}

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function maskLegacyShortDateInput(value: string) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 6);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 6)}`;
}

export function parseLegacyOrIsoDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.slice(0, 10));
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (isValidDateParts(year, month, day)) {
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      return date;
    }

    return null;
  }

  const shortMatch = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(raw);
  if (shortMatch) {
    const day = Number(shortMatch[1]);
    const month = Number(shortMatch[2]);
    const year = expandTwoDigitYear(Number(shortMatch[3]));
    if (isValidDateParts(year, month, day)) {
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      return date;
    }

    return null;
  }

  const longMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (longMatch) {
    const day = Number(longMatch[1]);
    const month = Number(longMatch[2]);
    const year = Number(longMatch[3]);
    if (isValidDateParts(year, month, day)) {
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      return date;
    }

    return null;
  }

  return null;
}

export function formatLegacyShortDateInput(value?: string | null) {
  const date = parseLegacyOrIsoDate(value);
  if (!date) return "";

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${pad(
    date.getFullYear() % 100,
  )}`;
}

export function formatIsoDateInput(value?: string | null) {
  const date = parseLegacyOrIsoDate(value);
  if (!date) return "";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}
