const UPPERCASE_PAYLOAD_FIELDS = new Set([
  "address",
  "bairro",
  "cidade",
  "city",
  "comment",
  "comments",
  "companyname",
  "complement",
  "complemento",
  "desc",
  "descricao",
  "description",
  "detail",
  "details",
  "detalhe",
  "detalhes",
  "endereco",
  "fullname",
  "logradouro",
  "name",
  "nameprofession",
  "neighborhood",
  "nome",
  "notes",
  "number",
  "obs",
  "observacao",
  "observacoes",
  "observation",
  "observations",
  "shortname",
  "state",
  "street",
  "tradename",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function shouldUppercaseField(fieldName: string) {
  return UPPERCASE_PAYLOAD_FIELDS.has(fieldName.toLocaleLowerCase("pt-BR"));
}

export function uppercasePayloadText<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => uppercasePayloadText(item)) as T;
  }

  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, currentValue]) => {
      if (typeof currentValue === "string" && shouldUppercaseField(key)) {
        return [key, currentValue.toLocaleUpperCase("pt-BR")];
      }

      return [key, uppercasePayloadText(currentValue)];
    }),
  ) as T;
}
