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

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function shouldUppercaseField(fieldName) {
  return UPPERCASE_PAYLOAD_FIELDS.has(String(fieldName).toLocaleLowerCase("pt-BR"));
}

function uppercasePayloadText(value) {
  if (Array.isArray(value)) {
    return value.map(uppercasePayloadText);
  }

  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, currentValue]) => {
      if (typeof currentValue === "string" && shouldUppercaseField(key)) {
        return [key, currentValue.toLocaleUpperCase("pt-BR")];
      }

      return [key, uppercasePayloadText(currentValue)];
    }),
  );
}

module.exports = {
  uppercasePayloadText,
};
