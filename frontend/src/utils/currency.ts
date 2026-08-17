export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCurrencyFromDigits(digitsValue: string) {
  if (!digitsValue) return "";

  const cents = Number(digitsValue);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatCurrencyInput(value: string) {
  return formatCurrencyFromDigits(onlyDigits(value));
}

export function formatCurrencyValue(value: number | string) {
  const numericValue =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/\./g, "").replace(",", "."));

  if (!Number.isFinite(numericValue)) {
    return "R$ 0,00";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericValue);
}

export function parseCurrencyToNumber(value: string) {
  const digitsValue = onlyDigits(value);

  if (!digitsValue) return 0;

  return Number(digitsValue) / 100;
}

export function formatCurrency(value: number | string) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(numValue)) return "R$ 0,00";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
}
