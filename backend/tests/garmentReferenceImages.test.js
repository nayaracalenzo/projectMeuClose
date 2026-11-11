const assert = require("node:assert/strict");
const test = require("node:test");

const repository = require("../src/repositories/garmentReferenceImagesRepository");
const service = require("../src/services/garmentReferenceImagesService");

const validPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

test("reference image upload validates and returns clean metadata", async (t) => {
  const originalCleanup = repository.deleteExpiredUnlinkedReferenceImages;
  const originalCreate = repository.createReferenceImage;
  let persistedPayload = null;

  repository.deleteExpiredUnlinkedReferenceImages = async () => 0;
  repository.createReferenceImage = async (payload) => {
    persistedPayload = payload;
    return {
      idGarmentReferenceImage: 42,
      ...payload,
    };
  };

  t.after(() => {
    repository.deleteExpiredUnlinkedReferenceImages = originalCleanup;
    repository.createReferenceImage = originalCreate;
  });

  const result = await service.createReferenceImage(
    {
      imageBase64: validPng.toString("base64"),
      mimeType: "image/png",
      originalName: encodeURIComponent("inspiração verão.png"),
    },
    { idUser: 7 },
  );

  assert.deepEqual(result, {
    id: 42,
    originalName: "inspiração verão.png",
    mimeType: "image/png",
    sizeBytes: validPng.length,
  });
  assert.equal(persistedPayload.uploadedByUserId, 7);
  assert.equal(persistedPayload.saleItemId, null);
  assert.equal(persistedPayload.imageData, validPng.toString("base64"));
  assert.ok(persistedPayload.expiresAt instanceof Date);
});

test("reference image upload rejects unsupported or forged files", async () => {
  await assert.rejects(
    service.createReferenceImage(
      {
        imageBase64: validPng.toString("base64"),
        mimeType: "image/gif",
        originalName: "referencia.gif",
      },
      {},
    ),
    /JPG, PNG ou WEBP/,
  );

  await assert.rejects(
    service.createReferenceImage(
      {
        imageBase64: Buffer.from("not-a-real-png").toString("base64"),
        mimeType: "image/png",
        originalName: "referencia.png",
      },
      {},
    ),
    /conteudo do arquivo/,
  );
});

test("reference image read decodes stored Base64", async (t) => {
  const originalGetById = repository.getReferenceImageById;

  repository.getReferenceImageById = async () => ({
    imageData: validPng.toString("base64"),
    mimeType: "image/png",
    originalName: "referencia.png",
    sizeBytes: validPng.length,
  });

  t.after(() => {
    repository.getReferenceImageById = originalGetById;
  });

  const image = await service.getReferenceImage(42);

  assert.ok(Buffer.isBuffer(image.imageData));
  assert.deepEqual(image.imageData, validPng);
  assert.equal(image.sizeBytes, validPng.length);
});
