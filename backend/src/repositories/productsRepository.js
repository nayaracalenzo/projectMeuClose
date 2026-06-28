const {
  Customers,
  ClothingsType,
  Colors,
  Employees,
  Fabrics,
  Products,
  ProductsTypes,
  Sizes,
  Status,
} = require("../models");

function normalizeText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeLookupText(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.toLowerCase() : null;
}

async function findOrCreateByDesc(model, desc, transaction) {
  const normalizedDesc = normalizeLookupText(desc);
  if (!normalizedDesc) return null;

  const existing = await model.findOne({
    where: { desc: normalizedDesc },
    transaction,
  });

  if (existing) {
    return existing;
  }

  return model.create(
    {
      desc: normalizedDesc,
    },
    { transaction },
  );
}

async function findEmployeeByShortName(shortName, transaction) {
  const normalizedShortName = normalizeText(shortName);
  if (!normalizedShortName) return null;

  return Employees.findOne({
    where: {
      shortName: normalizedShortName,
    },
    transaction,
  });
}

function roundCurrency(value) {
  if (value === null || value === undefined || value === "") return null;
  return Number(Number(value).toFixed(2));
}

function mapCustomMadeStatus(status) {
  const normalized = normalizeLookupText(status);

  if (!normalized) return "a produzir";
  if (normalized === "finalizada") return "produzida";

  return "a produzir";
}

function mapProductType(itemType) {
  return itemType === "CUSTOM_MADE" ? "sob medida" : "pronto";
}

async function buildProductPayload(sale, item, transaction) {
  const metadata = item.metadata || {};
  const isCustomMade = item.itemType === "CUSTOM_MADE";

  const [
    employee,
    status,
    productType,
    clothingType,
    color,
    fabric,
    size,
  ] = await Promise.all([
    isCustomMade ? findEmployeeByShortName(metadata.seamstress, transaction) : null,
    findOrCreateByDesc(
      Status,
      isCustomMade ? mapCustomMadeStatus(metadata.status) : "produzida",
      transaction,
    ),
    findOrCreateByDesc(ProductsTypes, mapProductType(item.itemType), transaction),
    isCustomMade ? findOrCreateByDesc(ClothingsType, item.description, transaction) : null,
    isCustomMade ? findOrCreateByDesc(Colors, metadata.color, transaction) : null,
    isCustomMade ? findOrCreateByDesc(Fabrics, metadata.fabric, transaction) : null,
    !isCustomMade ? findOrCreateByDesc(Sizes, metadata.size, transaction) : null,
  ]);

  const dressmakerValue = isCustomMade ? roundCurrency(metadata.seamstressCost) : null;
  const finalValue = roundCurrency(item.subtotal) || 0;
  const profit =
    dressmakerValue === null ? null : roundCurrency(finalValue - dressmakerValue);

  return {
    saleId: sale.idSale,
    desc: item.description,
    customerId: sale.customerId,
    employeeId: employee ? employee.idEmployee : null,
    statusId: status ? status.id : null,
    productTypeId: productType ? productType.id : null,
    clothingTypeId: clothingType ? clothingType.id : null,
    colorId: color ? color.id : null,
    fabricId: fabric ? fabric.id : null,
    sizeId: size ? size.id : null,
    details: isCustomMade ? normalizeText(metadata.details) : null,
    testDate: isCustomMade ? metadata.fittingDate || null : null,
    qtyStock: Number(item.quantity) || 1,
    dressmakerValue,
    finalValue,
    profit,
  };
}

async function createProductsFromSale(sale, items, transaction) {
  const payloads = [];

  for (const item of items) {
    payloads.push(await buildProductPayload(sale, item, transaction));
  }

  return Products.bulkCreate(payloads, { transaction });
}

async function listProducts() {
  return Products.findAll({
    include: [
      {
        model: Customers,
        attributes: ["idCustomer", "fullName", "companyName"],
      },
      {
        model: Employees,
        attributes: ["idEmployee", "shortName"],
      },
      {
        model: Status,
        attributes: ["id", "desc"],
      },
      {
        model: ProductsTypes,
        attributes: ["id", "desc"],
      },
      {
        model: ClothingsType,
        attributes: ["id", "desc"],
      },
    ],
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
  });
}

module.exports = {
  createProductsFromSale,
  listProducts,
};
