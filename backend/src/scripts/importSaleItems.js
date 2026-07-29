require("dotenv").config();
const fs = require("fs");
const csv = require("csv-parser");
const { Products, ProductsTypes, SaleItems, Sales } = require("../models");
const { normalizeLegacyCurrency } = require("../utils/normalizeLegacyCurrency");
const { resolveLegacyImportFilePath } = require("./legacyImportSource");

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) ? normalized : null;
}

function roundCurrency(value) {
  return Number(Number(value).toFixed(2));
}

function normalizeLookupKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function inferItemType(product) {
  const categoryId = Number(product?.categoryId || 0);
  const productTypeId = Number(product?.productTypeId || 0);
  const statusId = Number(product?.statusId || 0);
  const productTypeDesc = normalizeLookupKey(product?.productTypeDesc);

  if (categoryId === 4) return "ACCESSORY";
  if (
    productTypeDesc === "roupa sob medida" ||
    productTypeDesc === "ajuste" ||
    productTypeDesc === "reforma"
  ) {
    return "CUSTOM_MADE";
  }

  if (categoryId === 5) return "MISC";
  if (categoryId === 1 && statusId === 1) return "CUSTOM_MADE";
  if (categoryId === 1 && statusId === 5) return "CUSTOM_MADE";
  if (categoryId === 1 && productTypeId === 4) return "CUSTOM_MADE";
  if (categoryId === 1 && productTypeId === 7) return "CUSTOM_MADE";
  if (categoryId === 1 && productTypeId === 8) return "CUSTOM_MADE";
  if (categoryId === 1) return "READY_MADE";

  if (productTypeId === 4) return "CUSTOM_MADE";
  if (productTypeId === 7) return "CUSTOM_MADE";
  if (productTypeId === 8) return "CUSTOM_MADE";
  if (productTypeId === 5) return "MISC";

  return "MISC";
}

async function importSaleItems() {
  const rows = [];
  const filePath = resolveLegacyImportFilePath("itensVenda.csv");

  console.log("Iniciando leitura do CSV de itens de venda...");

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ";" }))
    .on("data", (data) => {
      rows.push(data);
    })
    .on("end", async () => {
      console.log(`Total encontrados no CSV: ${rows.length}`);

      const [sales, products] = await Promise.all([
        Sales.findAll({
          attributes: ["idSale", "createdAt"],
          raw: true,
        }),
        Products.findAll({
          attributes: [
            "id",
            "desc",
            "categoryId",
            "productTypeId",
            "statusId",
            "createdAt",
          ],
          include: [
            {
              model: ProductsTypes,
              attributes: ["desc"],
              required: false,
            },
          ],
          raw: true,
        }),
      ]);

      const salesMap = new Map(sales.map((sale) => [Number(sale.idSale), sale]));
      const productsMap = new Map(
        products.map((product) => [
          Number(product.id),
          {
            ...product,
            productTypeDesc: product["ProductsType.desc"] || null,
          },
        ]),
      );

      const saleItemsToInsert = [];
      let skipped = 0;

      for (const row of rows) {
        const legacyId = normalizeInteger(row.id);

        try {
          if (!legacyId) {
            skipped += 1;
            continue;
          }

          const saleId = normalizeInteger(row.idVen);
          const sale = saleId ? salesMap.get(saleId) : null;

          if (!sale) {
            console.warn(
              `Ignorando item de venda legado ${legacyId}: venda ${row.idVen || "sem-id"} invalida.`,
            );
            skipped += 1;
            continue;
          }

          const productId = normalizeInteger(row.idPro);
          const product = productId ? productsMap.get(productId) : null;
          const quantity = normalizeInteger(row.qtd) || 1;
          const unitPrice = normalizeLegacyCurrency(row.valUni);
          const subtotal = normalizeLegacyCurrency(row.valTot);
          const createdAt = sale.createdAt || product?.createdAt || new Date();

          if (unitPrice === null || subtotal === null) {
            console.warn(
              `Ignorando item de venda legado ${legacyId}: valores financeiros invalidos.`,
            );
            skipped += 1;
            continue;
          }

          saleItemsToInsert.push({
            idSaleItem: legacyId,
            saleId,
            productId: product ? product.id : null,
            itemType: inferItemType(product),
            description: product?.desc || "Item legado",
            metadata: null,
            unitPrice,
            quantity,
            discountType: null,
            discountValue: null,
            subtotal: roundCurrency(subtotal),
            createdAt,
            updatedAt: createdAt,
          });
        } catch (error) {
          console.error(
            `Erro ao processar item de venda legado ${legacyId || "sem-id"}:`,
            error.message,
          );
          skipped += 1;
        }
      }

      try {
        console.log("Inserindo itens de venda no banco...");

        await SaleItems.bulkCreate(saleItemsToInsert, {
          validate: true,
          updateOnDuplicate: [
            "saleId",
            "productId",
            "itemType",
            "description",
            "metadata",
            "unitPrice",
            "quantity",
            "discountType",
            "discountValue",
            "subtotal",
            "updatedAt",
          ],
        });

        await SaleItems.sequelize.query(`
          SELECT setval(
            pg_get_serial_sequence('"sale_items"', 'idSaleItem'),
            COALESCE((SELECT MAX("idSaleItem") FROM "sale_items"), 1),
            true
          );
        `);

        console.log("Importacao de itens de venda finalizada.");
        console.log(`Inseridos: ${saleItemsToInsert.length}`);
        console.log(`Ignorados: ${skipped}`);
      } catch (error) {
        console.error("Erro geral ao inserir itens de venda:", error.message);
      }

      await SaleItems.sequelize.close();
      process.exit();
    })
    .on("error", async (error) => {
      console.error("Erro ao ler o arquivo de itens de venda:", error.message);
      await SaleItems.sequelize.close();
      process.exit(1);
    });
}

if (require.main === module) {
  importSaleItems();
}

module.exports = importSaleItems;
