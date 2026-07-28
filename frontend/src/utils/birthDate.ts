const onlyDigits = (value?: string | null) => String(value || "").replace(/\D/g, "");

export function maskBirthDate(value?: string | null) {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function formatBirthDateFromApi(value?: string | null) {
  const base = String(value || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) return "";

  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function toBirthDateApiValue(value?: string | null) {
  const digits = onlyDigits(value);
  if (!digits) return null;
  if (digits.length !== 8) return null;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValid) return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
