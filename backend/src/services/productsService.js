const repository = require("../repositories/productsRepository");
const { notFoundError, validationError } = require("../errors/AppError");

function normalizeMeasurementRows(rows = []) {
  if (!Array.isArray(rows) || !rows.length) {
    return [];
  }

  return rows
    .map((row) => {
      const definition = row.MeasurementDefinition || row.MeasurementDefinitions || null;
      const value = row?.value;

      if (!definition || value === null || value === undefined || value === "") {
        return null;
      }

      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        return null;
      }

      return {
        idCustomerMeasurementValue: Number(row.idCustomerMeasurementValue || 0) || null,
        idMeasurementDefinition:
          Number(definition.idMeasurementDefinition || row.measurementDefinitionId || 0) || null,
        key: definition.key || null,
        label: definition.label || definition.key || null,
        sortOrder: Number(definition.sortOrder || 0),
        value: numericValue,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return Number(left.idCustomerMeasurementValue || 0) - Number(right.idCustomerMeasurementValue || 0);
    });
}

async function buildMeasurementsBySaleId(products = []) {
  const saleIds = Array.from(
    new Set(
      products
        .map((product) => {
          const saleItem = Array.isArray(product?.SaleItems) ? product.SaleItems[0] : null;
          return Number(saleItem?.saleId || 0);
        })
        .filter((saleId) => Number.isInteger(saleId) && saleId > 0),
    ),
  );

  if (!saleIds.length) {
    return new Map();
  }

  const rows = await repository.listMeasurementValuesBySaleIds(saleIds);
  const measurementsBySaleId = new Map();

  rows.forEach((row) => {
    const saleId = Number(row.saleId || 0);
    if (!Number.isInteger(saleId) || saleId <= 0) {
      return;
    }

    const currentRows = measurementsBySaleId.get(saleId) || [];
    currentRows.push(row);
    measurementsBySaleId.set(saleId, currentRows);
  });

  measurementsBySaleId.forEach((currentRows, saleId) => {
    measurementsBySaleId.set(saleId, normalizeMeasurementRows(currentRows));
  });

  return measurementsBySaleId;
}

function formatMeasurementsSummary(measurements) {
  if (!Array.isArray(measurements) || !measurements.length) {
    return "";
  }

  return measurements
    .map((measurement) => {
      const label =
        measurement?.label ||
        measurement?.MeasurementDefinition?.label ||
        measurement?.MeasurementDefinition?.key;
      const value = measurement?.value;

      if (!label || value === null || value === undefined || value === "") {
        return null;
      }

      return `${label}: ${Number(value)}`;
    })
    .filter(Boolean)
    .join(" | ");
}

function mapProductRow(product, measurementsBySaleId = new Map()) {
  const customer = product.Customer || product.Customers;
  const employee = product.Employee || product.Employees;
  const status = product.Status;
  const category = product.Category || product.Categories;
  const productType = product.ProductsType || product.ProductsTypes;
  const clothingType = product.ClothingsType;
  const color = product.Color || product.Colors;
  const fabric = product.Fabric || product.Fabrics;
  const size = product.Size || product.Sizes;
  const saleItem = Array.isArray(product.SaleItems) ? product.SaleItems[0] : null;
  const saleId = Number(saleItem?.saleId || 0) || null;
  const measurements = saleId ? measurementsBySaleId.get(saleId) || [] : [];

  return {
    id: product.id,
    saleId,
    description: product.desc,
    customer: customer?.fullName || customer?.companyName || "Sem cliente",
    category: category?.desc || null,
    productType: productType?.desc || null,
    clothingType: clothingType?.desc || null,
    seamstress: employee?.shortName || null,
    status: status?.desc || null,
    finalValue: Number(product.finalValue || 0),
    testDate: product.testDate,
    createdAt: product.createdAt,
    qtyStock: Number(product.qtyStock || 0),
    fabric: fabric?.desc || null,
    color: color?.desc || null,
    size: size?.desc || null,
    details: product.details || "",
    measurementsSummary: formatMeasurementsSummary(measurements),
  };
}

function mapProductDetails(product, measurementsBySaleId = new Map()) {
  const customer = product.Customer || product.Customers;
  const employee = product.Employee || product.Employees;
  const status = product.Status;
  const category = product.Category || product.Categories;
  const productType = product.ProductsType || product.ProductsTypes;
  const clothingType = product.ClothingsType;
  const color = product.Color || product.Colors;
  const fabric = product.Fabric || product.Fabrics;
  const size = product.Size || product.Sizes;
  const saleItem = Array.isArray(product.SaleItems) ? product.SaleItems[0] : null;
  const saleItemQuantity = Number(saleItem?.quantity || 0);
  const saleItemUnitPrice = Number(saleItem?.unitPrice || 0);
  const saleItemSubtotal = Number(saleItem?.subtotal || 0);
  const saleItemGrossValue = Number((saleItemQuantity * saleItemUnitPrice).toFixed(2));
  const saleItemDiscountAmount = Number(
    Math.max(0, saleItemGrossValue - saleItemSubtotal).toFixed(2),
  );
  const saleId = Number(saleItem?.saleId || 0) || null;
  const measurements = saleId ? measurementsBySaleId.get(saleId) || [] : [];

  return {
    id: product.id,
    saleId,
    desc: product.desc,
    details: product.details || "",
    customerId: product.customerId || null,
    customerName: customer?.fullName || customer?.companyName || null,
    employeeId: product.employeeId || null,
    employeeName: employee?.shortName || employee?.fullName || null,
    statusId: product.statusId || null,
    statusName: status?.desc || null,
    categoryId: product.categoryId || null,
    categoryName: category?.desc || null,
    productTypeId: product.productTypeId || null,
    productTypeName: productType?.desc || null,
    clothingTypeId: product.clothingTypeId || null,
    clothingTypeName: clothingType?.desc || null,
    colorId: product.colorId || null,
    colorName: color?.desc || null,
    fabricId: product.fabricId || null,
    fabricName: fabric?.desc || null,
    sizeId: product.sizeId || null,
    sizeName: size?.desc || null,
    qtyStock: Number(product.qtyStock || 0),
    testDate: product.testDate,
    dressmakerValue: Number(product.dressmakerValue || 0),
    finalValue: Number(product.finalValue || 0),
    remainingValue: Number(product.remainingValue || 0),
    saleItemQuantity,
    saleItemUnitPrice,
    saleItemDiscountType: saleItem?.discountType || null,
    saleItemDiscountValue:
      saleItem?.discountValue === null || saleItem?.discountValue === undefined
        ? null
        : Number(saleItem.discountValue),
    saleItemGrossValue,
    saleItemDiscountAmount,
    saleItemSubtotal,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    measurements,
    measurementsSummary: formatMeasurementsSummary(measurements),
  };
}

function normalizeText(value, { allowEmpty = true } = {}) {
  if (value === undefined || value === null) return allowEmpty ? "" : null;

  const normalized = String(value).trim();
  if (!normalized) {
    return allowEmpty ? "" : null;
  }

  return normalized;
}

function normalizeNullableId(value) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw validationError("Identificador inválido.");
  }

  return parsed;
}

function normalizeNullableInteger(value, { min = 0, fieldLabel = "Valor" } = {}) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw validationError(`${fieldLabel} inválido.`);
  }

  return parsed;
}

function normalizeNullableDecimal(value, { min = 0, fieldLabel = "Valor" } = {}) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw validationError(`${fieldLabel} inválido.`);
  }

  return Number(parsed.toFixed(2));
}

function normalizeNullableDate(value) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) {
    throw validationError("Data de prova inválida.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function normalizeFilterDate(value) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) {
    throw validationError("Filtro de data invÃ¡lido.");
  }

  return raw;
}

function normalizeProductPayload(body = {}) {
  const desc = normalizeText(body.desc, { allowEmpty: false });
  if (!desc) {
    throw validationError("Descrição do pedido é obrigatória.");
  }

  const qtyStock = normalizeNullableInteger(body.qtyStock, {
    min: 1,
    fieldLabel: "Quantidade",
  });
  if (qtyStock === null) {
    throw validationError("Quantidade é obrigatória.");
  }

  const finalValue = normalizeNullableDecimal(body.finalValue, {
    min: 0,
    fieldLabel: "Valor final",
  });
  if (finalValue === null) {
    throw validationError("Valor final é obrigatório.");
  }

  const dressmakerValue =
    normalizeNullableDecimal(body.dressmakerValue, {
      min: 0,
      fieldLabel: "Valor da costureira",
    }) ?? 0;

  if (dressmakerValue > finalValue) {
    throw validationError("Valor da costureira não pode ser maior que o valor final.");
  }

  return {
    desc,
    details: normalizeText(body.details),
    customerId: normalizeNullableId(body.customerId),
    employeeId: normalizeNullableId(body.employeeId),
    statusId: normalizeNullableId(body.statusId),
    categoryId: normalizeNullableId(body.categoryId),
    productTypeId: normalizeNullableId(body.productTypeId),
    clothingTypeId: normalizeNullableId(body.clothingTypeId),
    colorId: normalizeNullableId(body.colorId),
    fabricId: normalizeNullableId(body.fabricId),
    sizeId: normalizeNullableId(body.sizeId),
    qtyStock,
    testDate: normalizeNullableDate(body.testDate),
    dressmakerValue,
    finalValue,
    remainingValue: Number((finalValue - dressmakerValue).toFixed(2)),
  };
}

function validateDependencies(payload, dependencies) {
  if (payload.customerId && !dependencies.customer) {
    throw validationError("Cliente não encontrado.");
  }

  if (payload.employeeId && !dependencies.employee) {
    throw validationError("Costureira não encontrada.");
  }

  if (payload.statusId && !dependencies.status) {
    throw validationError("Status não encontrado.");
  }

  if (payload.categoryId && !dependencies.category) {
    throw validationError("Tipo de produto não encontrado.");
  }

  if (payload.productTypeId && !dependencies.productType) {
    throw validationError("Subtipo de produto não encontrado.");
  }

  if (payload.clothingTypeId && !dependencies.clothingType) {
    throw validationError("Tipo de roupa não encontrado.");
  }

  if (payload.colorId && !dependencies.color) {
    throw validationError("Cor não encontrada.");
  }

  if (payload.fabricId && !dependencies.fabric) {
    throw validationError("Tecido não encontrado.");
  }

  if (payload.sizeId && !dependencies.size) {
    throw validationError("Tamanho não encontrado.");
  }
}

async function listProducts(filters = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
  const startDate = normalizeFilterDate(filters.startDate);
  const endDate = normalizeFilterDate(filters.endDate);
  const result = await repository.listProducts({ ...filters, page, pageSize, startDate, endDate });
  const measurementsBySaleId = await buildMeasurementsBySaleId(result.rows);
  const items = result.rows.map((product) => mapProductRow(product, measurementsBySaleId));
  const total = Number(result.count || 0);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function listProductStatuses() {
  const statuses = await repository.listProductStatuses();

  return statuses.map((status) => ({
    id: status.id,
    desc: status.desc,
  }));
}

async function getProductById(id) {
  const normalizedId = Number(id);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw validationError("Pedido inválido.");
  }

  const product = await repository.getProductById(normalizedId);
  if (!product) {
    throw notFoundError("Pedido não encontrado.");
  }

  const measurementsBySaleId = await buildMeasurementsBySaleId([product]);
  return mapProductDetails(product, measurementsBySaleId);
}

async function updateProductById(id, body) {
  const normalizedId = Number(id);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw validationError("Pedido inválido.");
  }

  const existing = await repository.getProductById(normalizedId);
  if (!existing) {
    throw notFoundError("Pedido não encontrado.");
  }

  const payload = normalizeProductPayload(body);
  const dependencies = await repository.getProductUpdateDependencies(payload);
  validateDependencies(payload, dependencies);

  const updated = await repository.updateProductById(normalizedId, payload);
  if (!updated) {
    throw notFoundError("Pedido não encontrado.");
  }

  const measurementsBySaleId = await buildMeasurementsBySaleId([updated]);
  return mapProductDetails(updated, measurementsBySaleId);
}

module.exports = {
  getProductById,
  listProducts,
  listProductStatuses,
  updateProductById,
};
