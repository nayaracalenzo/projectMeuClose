export function formatContact(value: string | null | undefined) {
  if (!value || value === "") return "-";

  const numbers = value.replace(/\D/g, "");

  if (numbers.length === 8) {
    return numbers.replace(/(\d{4})(\d{4})/, "(85) $1-$2");
  }
  if (numbers.length === 9) {
    return numbers.replace(/(\d{1})(\d{4})(\d{4})/, "(85) $1 $2-$3");
  }

  if (numbers.length === 10) {
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  if (numbers.length === 11) {
    return numbers[0] === "0" ? numbers.replace(/(\d{3})(\d{4})(\d{4})/, "($1) $2-$3") : numbers.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, "($1) $2 $3-$4");
  }
  return value;
}
