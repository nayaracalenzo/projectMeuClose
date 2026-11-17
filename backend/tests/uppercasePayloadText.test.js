const test = require("node:test");
const assert = require("node:assert/strict");

const {
  uppercasePayloadText,
} = require("../src/utils/uppercasePayloadText");

test("uppercases only configured business text fields in nested payloads", () => {
  const payload = uppercasePayloadText({
    fullName: "José da Silva",
    email: "Jose.Silva@example.com",
    password: "SenhaComMaiusculas",
    address: {
      street: "Rua São João",
      number: "12 A",
      neighborhood: "Jardim América",
      zipCode: "12345-678",
    },
    items: [
      {
        description: "Vestido de festa",
        metadata: {
          details: "Manga com aplicação",
          originalName: "ReferenciaVestido.png",
          imageBase64: "AbCdEf123",
        },
      },
    ],
    notes: "Cliente prefere contato pela manhã",
  });

  assert.equal(payload.fullName, "JOSÉ DA SILVA");
  assert.equal(payload.email, "Jose.Silva@example.com");
  assert.equal(payload.password, "SenhaComMaiusculas");
  assert.equal(payload.address.street, "RUA SÃO JOÃO");
  assert.equal(payload.address.number, "12 A");
  assert.equal(payload.address.neighborhood, "JARDIM AMÉRICA");
  assert.equal(payload.address.zipCode, "12345-678");
  assert.equal(payload.items[0].description, "VESTIDO DE FESTA");
  assert.equal(payload.items[0].metadata.details, "MANGA COM APLICAÇÃO");
  assert.equal(payload.items[0].metadata.originalName, "ReferenciaVestido.png");
  assert.equal(payload.items[0].metadata.imageBase64, "AbCdEf123");
  assert.equal(payload.notes, "CLIENTE PREFERE CONTATO PELA MANHÃ");
});
