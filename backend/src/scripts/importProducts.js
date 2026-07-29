require("dotenv").config();
const fs = require("fs");
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
const { resolveLegacyImportFilePath } = require("./legacyImportSource");

const ACCESSORY_CLOTHING_TYPE_ID = 39;
const ADJUSTMENT_CLOTHING_TYPE_ID = 82;
const REFORM_CLOTHING_TYPE_ID = 101;

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

function normalizeLookupKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildLookupMap(rows = []) {
  return new Map(
    rows.map((item) => [normalizeLookupKey(item.desc), Number(item.id)]),
  );
}

function inferCategoryKey(clothingTypeId, productTypeId) {
  if (clothingTypeId === ACCESSORY_CLOTHING_TYPE_ID) {
    return "acessorios";
  }

  if (productTypeId === 3) {
    return "diversos";
  }

  return "roupas";
}

function inferProductTypeKey(clothingTypeId, productTypeId, categoryKey) {
  if (clothingTypeId === ADJUSTMENT_CLOTHING_TYPE_ID) {
    return "ajuste";
  }

  if (clothingTypeId === REFORM_CLOTHING_TYPE_ID) {
    return "reforma";
  }

  if (categoryKey === "acessorios") {
    return "acessorio";
  }

  if (productTypeId === 4) {
    return "roupa sob medida";
  }

  if (productTypeId === 3 || productTypeId === 5) {
    return "produto";
  }

  return "roupa pronta";
}

function resolveSpecialDescription(clothingTypeId) {
  if (clothingTypeId === ACCESSORY_CLOTHING_TYPE_ID) return "Acessório";
  if (clothingTypeId === ADJUSTMENT_CLOTHING_TYPE_ID) return "Ajuste";
  if (clothingTypeId === REFORM_CLOTHING_TYPE_ID) return "Reforma";
  return null;
}

async function importProducts() {
  const rows = [];
  const filePath = resolveLegacyImportFilePath("produto.csv");

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
        ClothingsType.findAll({ attributes: ["id", "desc"], raw: true }),
        Colors.findAll({ attributes: ["id", "desc"], raw: true }),
        Fabrics.findAll({ attributes: ["id", "desc"], raw: true }),
        Sizes.findAll({ attributes: ["id", "desc"], raw: true }),
      ]);

      const validCategoryIds = new Set(categories.map((item) => Number(item.id)));
      const validCustomerIds = new Set(customers.map((item) => Number(item.idCustomer)));
      const validEmployeeIds = new Set(employees.map((item) => Number(item.idEmployee)));
      const validStatusIds = new Set(statusList.map((item) => Number(item.id)));
      const validProductTypeIds = new Set(productsTypes.map((item) => Number(item.id)));
      const categoryLookup = buildLookupMap(categories);
      const productTypeLookup = buildLookupMap(productsTypes);
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
          const categoryKey = inferCategoryKey(clothingTypeId, productTypeIdFromLegacy);
          const productTypeKey = inferProductTypeKey(
            clothingTypeId,
            productTypeIdFromLegacy,
            categoryKey,
          );
          const categoryId = categoryLookup.get(categoryKey) || null;
          const normalizedProductTypeId = productTypeLookup.get(productTypeKey) || null;
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
          const fallbackCategoryId =
            categoryLookup.get("diversos") || categoryLookup.get("roupas") || null;
          const resolvedCategoryId =
            categoryId && validCategoryIds.has(categoryId) ? categoryId : fallbackCategoryId;
          const resolvedProductTypeId =
            normalizedProductTypeId && validProductTypeIds.has(normalizedProductTypeId)
              ? normalizedProductTypeId
              : null;
          const clothingCategoryId = categoryLookup.get("roupas") || null;
          const accessoryCategoryId = categoryLookup.get("acessorios") || null;
          const allowsClothingType =
            resolvedCategoryId === clothingCategoryId || resolvedCategoryId === accessoryCategoryId;
          const resolvedClothingTypeId =
            allowsClothingType && clothingTypeId && clothingTypeMap.has(clothingTypeId)
              ? clothingTypeId
              : null;
          const resolvedColorId = colorId && colorMap.has(colorId) ? colorId : null;
          const resolvedFabricId = fabricId && fabricMap.has(fabricId) ? fabricId : null;
          const resolvedSizeId = sizeId && sizeMap.has(sizeId) ? sizeId : null;
          const finalValue = normalizeLegacyCurrency(row.pre) || 0;
          const dressmakerValue = normalizeLegacyCurrency(row.pgCos) ?? 0;
          const remainingValue = Number((finalValue - dressmakerValue).toFixed(2));
          const qtyStock = normalizeInteger(row.qtdEst) || 0;

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
            qtyStock,
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
          updateOnDuplicate: [
            "desc",
            "customerId",
            "employeeId",
            "statusId",
            "categoryId",
            "productTypeId",
            "clothingTypeId",
            "colorId",
            "fabricId",
            "sizeId",
            "details",
            "testDate",
            "qtyStock",
            "dressmakerValue",
            "finalValue",
            "remainingValue",
            "updatedAt",
          ],
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

if (require.main === module) {
  importProducts();
}

module.exports = importProducts;
