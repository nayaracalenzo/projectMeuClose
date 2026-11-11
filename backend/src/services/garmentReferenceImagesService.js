const { notFoundError, validationError } = require("../errors/AppError");
const repository = require("../repositories/garmentReferenceImagesRepository");

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const UNLINKED_IMAGE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeUserId(user) {
  const id = Number(user?.id ?? user?.idUser);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeOriginalName(value) {
  let decoded = String(value || "referencia");

  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the original header value when it is not URI encoded.
  }

  const normalized = decoded.replace(/[\\/\0-\x1f\x7f]/g, "_").trim();
  return (normalized || "referencia").slice(0, 255);
}

function hasValidSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  }

  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

function decodeBase64(value) {
  const normalized = String(value || "").replace(/\s/g, "");

  if (
    normalized.length === 0 ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
  ) {
    throw validationError("A imagem em Base64 e invalida.");
  }

  const buffer = Buffer.from(normalized, "base64");
  const comparableInput = normalized.replace(/=+$/, "");
  const comparableOutput = buffer.toString("base64").replace(/=+$/, "");

  if (comparableInput !== comparableOutput) {
    throw validationError("A imagem em Base64 e invalida.");
  }

  return {
    base64: buffer.toString("base64"),
    buffer,
  };
}

function decodeStoredImageData(value, mimeType) {
  if (Buffer.isBuffer(value) && hasValidSignature(value, mimeType)) {
    return value;
  }

  const storedBase64 = Buffer.isBuffer(value) ? value.toString("utf8") : value;
  return decodeBase64(storedBase64).buffer;
}

async function createReferenceImage({ imageBase64, mimeType, originalName }, user) {
  const normalizedMimeType = String(mimeType || "").trim().toLowerCase();

  if (!ALLOWED_IMAGE_TYPES.has(normalizedMimeType)) {
    throw validationError("Envie uma imagem JPG, PNG ou WEBP.");
  }

  if (!imageBase64) {
    throw validationError("A imagem enviada esta vazia.");
  }

  const { base64, buffer: imageData } = decodeBase64(imageBase64);

  if (imageData.length > MAX_IMAGE_SIZE_BYTES) {
    throw validationError("A imagem deve ter no maximo 5 MB.");
  }

  if (!hasValidSignature(imageData, normalizedMimeType)) {
    throw validationError("O conteudo do arquivo nao corresponde a uma imagem valida.");
  }

  await repository.deleteExpiredUnlinkedReferenceImages();

  const expiresAt = new Date(Date.now() + UNLINKED_IMAGE_RETENTION_MS);
  const created = await repository.createReferenceImage({
    saleItemId: null,
    uploadedByUserId: normalizeUserId(user),
    originalName: normalizeOriginalName(originalName),
    mimeType: normalizedMimeType,
    sizeBytes: imageData.length,
    imageData: base64,
    expiresAt,
  });

  return {
    id: created.idGarmentReferenceImage,
    originalName: created.originalName,
    mimeType: created.mimeType,
    sizeBytes: created.sizeBytes,
  };
}

async function getReferenceImage(id) {
  const normalizedId = Number(id);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw validationError("Imagem de referencia invalida.");
  }

  const image = await repository.getReferenceImageById(normalizedId);

  if (!image) {
    throw notFoundError("Imagem de referencia nao encontrada.");
  }

  return {
    imageData: decodeStoredImageData(image.imageData, image.mimeType),
    mimeType: image.mimeType,
    originalName: image.originalName,
    sizeBytes: image.sizeBytes,
  };
}

module.exports = {
  createReferenceImage,
  getReferenceImage,
};
