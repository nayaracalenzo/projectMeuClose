require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const {
  Categories,
  ClothingsType,
  Colors,
  Customers,
  Employees,
  Fabrics,
  Products,
  ProductsTypes,
  Sizes,
  Status,
} = require("../models");
const { normalizeLegacyCurrency } = require("../utils/normalizeLegacyCurrency");
const parseDate = require("../utils/parseDate");

const ACCESSORY_CLOTHING_TYPE_ID = 39;
const ADJUSTMENT_CLOTHING_TYPE_ID = 82;
const REFORM_CLOTHING_TYPE_ID = 101;

const CATEGORY_IDS = {
  CLOTHING: 1,
  SERVICE: 3,
  ACCESSORY: 4,
  MISC: 5,
};

const PRODUCT_TYPE_IDS = {
  READY_CLOTHING: 1,
  PRODUCT: 3,
  CUSTOM_CLOTHING: 4,
  SERVICE: 5,
  ACCESSORY: 6,
};

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) ? normalized : null;
}

function inferCategoryId(clothingTypeId, productTypeId) {
  if (clothingTypeId === ACCESSORY_CLOTHING_TYPE_ID) {
    return CATEGORY_IDS.ACCESSORY;
  }

  if (
    clothingTypeId === ADJUSTMENT_CLOTHING_TYPE_ID ||
    clothingTypeId === REFORM_CLOTHING_TYPE_ID
  ) {
    return CATEGORY_IDS.SERVICE;
  }

  if (productTypeId === PRODUCT_TYPE_IDS.SERVICE) {
    return CATEGORY_IDS.SERVICE;
  }

  if (productTypeId === PRODUCT_TYPE_IDS.PRODUCT) {
    return CATEGORY_IDS.MISC;
  }

  return CATEGORY_IDS.CLOTHING;
}

function inferProductTypeId(clothingTypeId, productTypeId, categoryId, statusId) {
  if (categoryId === CATEGORY_IDS.ACCESSORY) {
    return PRODUCT_TYPE_IDS.ACCESSORY;
  }

  if (categoryId === CATEGORY_IDS.SERVICE) {
    return PRODUCT_TYPE_IDS.SERVICE;
  }

  if (categoryId === CATEGORY_IDS.CLOTHING && statusId === 1) {
    return PRODUCT_TYPE_IDS.CUSTOM_CLOTHING;
  }

  if (productTypeId) {
    return productTypeId;
  }

  return PRODUCT_TYPE_IDS.READY_CLOTHING;
}

function resolveSpecialDescription(clothingTypeId) {
  if (clothingTypeId === ACCESSORY_CLOTHING_TYPE_ID) return "Acessório";
  if (clothingTypeId === ADJUSTMENT_CLOTHING_TYPE_ID) return "Ajuste";
  if (clothingTypeId === REFORM_CLOTHING_TYPE_ID) return "Reforma";
  return null;
}

async function importProducts() {
  const rows = [];
  const filePath = path.join(__dirname, "produto.csv");

  console.log("Iniciando leitura do CSV de produtos...");

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ";" }))
    .on("data", (data) => {
      rows.push(data);
    })
    .on("end", async () => {
      console.log(`Total encontrados no CSV: ${rows.length}`);

      const [
        categories,
        customers,
        employees,
        statusList,
        productsTypes,
        clothingsTypes,
        colors,
        fabrics,
        sizes,
      ] = await Promise.all([
        Categories.findAll({ raw: true }),
        Customers.findAll({ attributes: ["idCustomer"], raw: true }),
        Employees.findAll({ attributes: ["idEmployee"], raw: true }),
        Status.findAll({ raw: true }),
        ProductsTypes.findAll({ raw: true }),
        ClothingsType.findAll({ raw: true }),
        Colors.findAll({ raw: true }),
        Fabrics.findAll({ raw: true }),
        Sizes.findAll({ raw: true }),
      ]);

      const validCategoryIds = new Set(categories.map((item) => Number(item.id)));
      const validCustomerIds = new Set(customers.map((item) => Number(item.idCustomer)));
      const validEmployeeIds = new Set(employees.map((item) => Number(item.idEmployee)));
      const validStatusIds = new Set(statusList.map((item) => Number(item.id)));
      const validProductTypeIds = new Set(productsTypes.map((item) => Number(item.id)));
      const clothingTypeMap = new Map(
        clothingsTypes.map((item) => [Number(item.id), String(item.desc || "").trim()]),
      );
      const colorMap = new Map(
        colors.map((item) => [Number(item.id), String(item.desc || "").trim()]),
      );
      const fabricMap = new Map(
        fabrics.map((item) => [Number(item.id), String(item.desc || "").trim()]),
      );
      const sizeMap = new Map(
        sizes.map((item) => [Number(item.id), String(item.desc || "").trim()]),
      );

      const productsToInsert = [];
      let skipped = 0;

      for (const row of rows) {
        const legacyId = normalizeInteger(row.id);

        try {
          if (!legacyId) {
            skipped += 1;
            continue;
          }

          const rawDescription = normalizeText(row.des);
          const clothingTypeId = normalizeInteger(row.idTipRou);
          const productTypeIdFromLegacy = normalizeInteger(row.idTipPro);
          const statusId = normalizeInteger(row.idSit);
          const categoryId = inferCategoryId(clothingTypeId, productTypeIdFromLegacy);
          const normalizedProductTypeId = inferProductTypeId(
            clothingTypeId,
            productTypeIdFromLegacy,
            categoryId,
            statusId,
          );
          const customerId = normalizeInteger(row.idCli);
          const employeeId = normalizeInteger(row.idFunc);
          const colorId = normalizeInteger(row.idCor);
          const fabricId = normalizeInteger(row.idTec);
          const sizeId = normalizeInteger(row.idTam);
          const specialDescription = resolveSpecialDescription(clothingTypeId);

          const resolvedCustomerId =
            customerId && validCustomerIds.has(customerId) ? customerId : null;
          const resolvedEmployeeId =
            employeeId && validEmployeeIds.has(employeeId) ? employeeId : null;
          const resolvedStatusId = statusId && validStatusIds.has(statusId) ? statusId : 2;
          const resolvedCategoryId = validCategoryIds.has(categoryId)
            ? categoryId
            : CATEGORY_IDS.MISC;
          const resolvedProductTypeId =
            normalizedProductTypeId && validProductTypeIds.has(normalizedProductTypeId)
              ? normalizedProductTypeId
              : null;
          const resolvedClothingTypeId =
            resolvedCategoryId === CATEGORY_IDS.CLOTHING &&
            clothingTypeId &&
            clothingTypeMap.has(clothingTypeId)
              ? clothingTypeId
              : null;
          const resolvedColorId = colorId && colorMap.has(colorId) ? colorId : null;
          const resolvedFabricId = fabricId && fabricMap.has(fabricId) ? fabricId : null;
          const resolvedSizeId = sizeId && sizeMap.has(sizeId) ? sizeId : null;
          const finalValue = normalizeLegacyCurrency(row.pre) || 0;
          const dressmakerValue = normalizeLegacyCurrency(row.pgCos) ?? 0;
          const remainingValue = Number((finalValue - dressmakerValue).toFixed(2));

          productsToInsert.push({
            id: legacyId,
            desc: rawDescription || specialDescription || "Produto legado",
            customerId: resolvedCustomerId,
            employeeId: resolvedEmployeeId,
            statusId: resolvedStatusId,
            categoryId: resolvedCategoryId,
            productTypeId: resolvedProductTypeId,
            clothingTypeId: resolvedClothingTypeId,
            colorId: resolvedColorId,
            fabricId: resolvedFabricId,
            sizeId: resolvedSizeId,
            details: normalizeText(row.det),
            testDate: parseDate(row.dtPro) || null,
            qtyStock: row.qtdEst,
            dressmakerValue,
            finalValue,
            remainingValue,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (error) {
          console.error(
            `Erro ao processar produto legado ${legacyId || row.codBar || "sem-id"}:`,
            error.message,
          );
          skipped += 1;
        }
      }

      try {
        console.log("Inserindo produtos no banco...");

        await Products.bulkCreate(productsToInsert, {
          validate: true,
          ignoreDuplicates: true,
        });

        await Products.sequelize.query(`
          SELECT setval(
            pg_get_serial_sequence('"products"', 'id'),
            COALESCE((SELECT MAX("id") FROM "products"), 1),
            true
          );
        `);

        console.log("Importacao de produtos finalizada.");
        console.log(`Inseridos: ${productsToInsert.length}`);
        console.log(`Ignorados: ${skipped}`);
      } catch (error) {
        console.error("Erro geral ao inserir produtos:", error.message);
      }

      await Products.sequelize.close();
      process.exit();
    })
    .on("error", async (error) => {
      console.error("Erro ao ler o arquivo de produtos:", error.message);
      await Products.sequelize.close();
      process.exit(1);
    });
}

importProducts();
