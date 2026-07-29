const {
  Categories,
  Customers,
  CustomerMeasurementValues,
  ClothingsType,
  Colors,
  Employees,
  Fabrics,
  MeasurementDefinitions,
  Products,
  ProductsTypes,
  SaleItems,
  Sales,
  Sequelize,
  Sizes,
  Status,
} = require("../models");
const { Op } = require("sequelize");

async function syncProductsSequence(transaction) {
  await Products.sequelize.query(
    `
      SELECT setval(
        pg_get_serial_sequence('"products"', 'id'),
        COALESCE((SELECT MAX("id") FROM "products"), 1),
        true
      );
    `,
    { transaction },
  );
}

async function syncModelSequence(model, transaction) {
  const primaryKeyField = Array.isArray(model.primaryKeyAttributes)
    ? model.primaryKeyAttributes[0]
    : null;
  const tableName = model.getTableName();
  const resolvedTableName =
    typeof tableName === "string" ? tableName : tableName?.tableName;

  if (!primaryKeyField || !resolvedTableName) {
    return;
  }

  await model.sequelize.query(
    `
      SELECT setval(
        pg_get_serial_sequence('"${resolvedTableName}"', '${primaryKeyField}'),
        COALESCE((SELECT MAX("${primaryKeyField}") FROM "${resolvedTableName}"), 1),
        true
      );
    `,
    { transaction },
  );
}

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
    where: {
      desc: {
        [Op.iLike]: normalizedDesc,
      },
    },
    transaction,
  });

  if (existing) {
    return existing;
  }

  await syncModelSequence(model, transaction);
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

function getProductInclude() {
  return [
    {
      model: SaleItems,
      attributes: ["saleId", "itemType", "metadata"],
      required: false,
      include: [
        {
          model: Sales,
          attributes: ["idSale"],
          required: false,
          include: [
            {
              model: CustomerMeasurementValues,
              attributes: ["idCustomerMeasurementValue", "value"],
              required: false,
              include: [
                {
                  model: MeasurementDefinitions,
                  attributes: ["idMeasurementDefinition", "key", "label", "sortOrder"],
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      model: Customers,
      attributes: ["idCustomer", "fullName", "companyName"],
    },
    {
      model: Employees,
      attributes: ["idEmployee", "shortName", "fullName"],
    },
    {
      model: Status,
      attributes: ["id", "desc"],
    },
    {
      model: Categories,
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
    {
      model: Colors,
      attributes: ["id", "desc"],
    },
    {
      model: Fabrics,
      attributes: ["id", "desc"],
    },
    {
      model: Sizes,
      attributes: ["id", "desc"],
    },
  ];
}

function mapCustomMadeStatus(status) {
  const normalized = normalizeLookupText(status);

  if (!normalized) return "a produzir";
  if (normalized === "finalizada") return "produzida";

  return "a produzir";
}

function mapProductType(itemType, metadata = {}) {
  const productMode = normalizeText(metadata.productMode);

  if (itemType === "CUSTOM_MADE") return productMode || "Sob medida";
  if (itemType === "READY_MADE") return "Roupa Pronta";
  if (itemType === "SERVICE") return "Serviço";
  if (itemType === "ACCESSORY" || itemType === "MISC") return "Produto";
  return null;
}

function mapCategoryId(itemType) {
  if (itemType === "CUSTOM_MADE" || itemType === "READY_MADE") return 1;
  if (itemType === "SERVICE") return 3;
  if (itemType === "ACCESSORY") return 4;
  if (itemType === "MISC") return 5;
  return null;
}

async function buildProductPayload(customerId, item, transaction) {
  const metadata = item.metadata || {};
  const isCustomMade = item.itemType === "CUSTOM_MADE";
  const isReadyMade = item.itemType === "READY_MADE";
  const categoryId = mapCategoryId(item.itemType);
  const productTypeDesc = mapProductType(item.itemType, metadata);
  const clothingTypeSource = isCustomMade ? metadata.clothingType || item.description : null;

  const [
    employee,
    status,
    category,
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
    categoryId ? Categories.findByPk(categoryId, { transaction }) : null,
    productTypeDesc ? findOrCreateByDesc(ProductsTypes, productTypeDesc, transaction) : null,
    isCustomMade ? findOrCreateByDesc(ClothingsType, clothingTypeSource, transaction) : null,
    isCustomMade ? findOrCreateByDesc(Colors, metadata.color, transaction) : null,
    isCustomMade ? findOrCreateByDesc(Fabrics, metadata.fabric, transaction) : null,
    isReadyMade ? findOrCreateByDesc(Sizes, metadata.size, transaction) : null,
  ]);

  const dressmakerValue = isCustomMade
    ? roundCurrency(metadata.seamstressCost)
    : roundCurrency(metadata.materialCost);
  const finalValue = roundCurrency(item.subtotal) || 0;
  const remainingValue =
    dressmakerValue === null ? null : roundCurrency(finalValue - dressmakerValue);

  return {
    desc: item.description,
    customerId,
    employeeId: employee ? employee.idEmployee : null,
    statusId: status ? status.id : null,
    categoryId: category ? category.id : categoryId,
    productTypeId: productType ? productType.id : null,
    clothingTypeId: clothingType ? clothingType.id : null,
    colorId: color ? color.id : null,
    fabricId: fabric ? fabric.id : null,
    sizeId: size ? size.id : null,
    details: normalizeText(metadata.details),
    testDate: isCustomMade ? metadata.fittingDate || null : null,
    dsbl: false,
    qtyStock: Number(item.quantity) || 1,
    dressmakerValue,
    finalValue,
    remainingValue,
  };
}

async function createProductsFromSale(sale, items, transaction) {
  const payloads = [];

  for (const item of items) {
    payloads.push(await buildProductPayload(sale.customerId, item, transaction));
  }

  await syncProductsSequence(transaction);
  return Products.bulkCreate(payloads, { transaction });
}

async function listProducts(filters = {}) {
  const normalizedStatusId =
    filters.statusId === undefined || filters.statusId === null || filters.statusId === ""
      ? null
      : Number(filters.statusId);
  const productionOnly =
    String(filters.productionOnly || "").trim().toLowerCase() === "true";
  const normalizedPage = Math.max(1, Number(filters.page) || 1);
  const normalizedPageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
  const normalizedSortBy = String(filters.sortBy || "createdAtDesc");
  const statusWhere =
    normalizedStatusId && Number.isInteger(normalizedStatusId)
      ? normalizedStatusId === 1
        ? { statusId: [1, 5] }
        : { statusId: normalizedStatusId }
      : {};
  const where = {
    dsbl: false,
    ...statusWhere,
  };

  if (productionOnly) {
    where[Sequelize.Op.and] = [
      Sequelize.literal(`
        EXISTS (
          SELECT 1
          FROM "sale_items" AS psi
          WHERE psi."productId" = "Products"."id"
            AND psi."itemType" = 'CUSTOM_MADE'
        )
      `),
      Sequelize.literal(`
        NOT EXISTS (
          SELECT 1
          FROM "sale_items" AS si
          INNER JOIN "sales" AS s
            ON s."idSale" = si."saleId"
          WHERE si."productId" = "Products"."id"
            AND s."status" = 'BUDGET'
        )
      `),
    ];
  }

  const orderMap = {
    createdAtDesc: [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
    testDateAsc: [
      [Sequelize.literal('CASE WHEN "Products"."testDate" IS NULL THEN 1 ELSE 0 END'), "ASC"],
      ["testDate", "ASC"],
      ["id", "DESC"],
    ],
    testDateDesc: [
      [Sequelize.literal('CASE WHEN "Products"."testDate" IS NULL THEN 1 ELSE 0 END'), "ASC"],
      ["testDate", "DESC"],
      ["id", "DESC"],
    ],
  };

  if (filters.startDate || filters.endDate) {
    where.testDate = {};

    if (filters.startDate) {
      where.testDate[Sequelize.Op.gte] = filters.startDate;
    }

    if (filters.endDate) {
      where.testDate[Sequelize.Op.lte] = filters.endDate;
    }
  }

  return Products.findAndCountAll({
    where,
    include: getProductInclude(),
    order: orderMap[normalizedSortBy] || orderMap.createdAtDesc,
    limit: normalizedPageSize,
    offset: (normalizedPage - 1) * normalizedPageSize,
    distinct: true,
  });
}

async function listProductStatuses() {
  return Status.findAll({
    attributes: ["id", "desc"],
    order: [["id", "ASC"]],
  });
}

async function getProductById(id) {
  return Products.findOne({
    where: {
      id,
      dsbl: false,
    },
    include: getProductInclude(),
    order: [[SaleItems, "saleId", "DESC"]],
  });
}

async function getProductUpdateDependencies(payload = {}) {
  const [
    customer,
    employee,
    status,
    category,
    productType,
    clothingType,
    color,
    fabric,
    size,
  ] = await Promise.all([
    payload.customerId ? Customers.findByPk(payload.customerId) : null,
    payload.employeeId ? Employees.findByPk(payload.employeeId) : null,
    payload.statusId ? Status.findByPk(payload.statusId) : null,
    payload.categoryId ? Categories.findByPk(payload.categoryId) : null,
    payload.productTypeId ? ProductsTypes.findByPk(payload.productTypeId) : null,
    payload.clothingTypeId ? ClothingsType.findByPk(payload.clothingTypeId) : null,
    payload.colorId ? Colors.findByPk(payload.colorId) : null,
    payload.fabricId ? Fabrics.findByPk(payload.fabricId) : null,
    payload.sizeId ? Sizes.findByPk(payload.sizeId) : null,
  ]);

  return {
    customer,
    employee,
    status,
    category,
    productType,
    clothingType,
    color,
    fabric,
    size,
  };
}

async function updateProductById(id, payload) {
  const product = await Products.findOne({
    where: {
      id,
      dsbl: false,
    },
  });

  if (!product) return null;

  await product.update(payload);
  return getProductById(id);
}

async function listMeasurementValuesBySaleIds(saleIds = []) {
  const normalizedSaleIds = Array.from(
    new Set(
      saleIds
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0),
    ),
  );

  if (!normalizedSaleIds.length) {
    return [];
  }

  return CustomerMeasurementValues.findAll({
    where: {
      saleId: normalizedSaleIds,
    },
    include: [
      {
        model: MeasurementDefinitions,
        attributes: ["idMeasurementDefinition", "key", "label", "sortOrder"],
        required: false,
      },
    ],
    order: [
      ["saleId", "ASC"],
      [MeasurementDefinitions, "sortOrder", "ASC"],
      ["idCustomerMeasurementValue", "ASC"],
    ],
  });
}

module.exports = {
  createProductsFromSale,
  getProductById,
  getProductUpdateDependencies,
  listProducts,
  listMeasurementValuesBySaleIds,
  listProductStatuses,
  syncProductsSequence,
  updateProductById,
};
