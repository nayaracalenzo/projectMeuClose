require("dotenv").config();
const { Products } = require("../models");

const CATEGORY_IDS = {
  CLOTHING: 1,
  SERVICE: 3,
  ACCESSORY: 4,
};

const PRODUCT_TYPE_IDS = {
  READY_CLOTHING: 1,
  CUSTOM_CLOTHING: 4,
  SERVICE: 5,
  ACCESSORY: 6,
};

async function fixImportedProductsTypes() {
  try {
    const [accessoryUpdatedCount] = await Products.update(
      { productTypeId: PRODUCT_TYPE_IDS.ACCESSORY },
      {
        where: {
          categoryId: CATEGORY_IDS.ACCESSORY,
        },
      },
    );

    const [serviceUpdatedCount] = await Products.update(
      { productTypeId: PRODUCT_TYPE_IDS.SERVICE },
      {
        where: {
          categoryId: CATEGORY_IDS.SERVICE,
        },
      },
    );

    const [customClothingUpdatedCount] = await Products.update(
      { productTypeId: PRODUCT_TYPE_IDS.CUSTOM_CLOTHING },
      {
        where: {
          categoryId: CATEGORY_IDS.CLOTHING,
          statusId: 1,
          productTypeId: PRODUCT_TYPE_IDS.READY_CLOTHING,
        },
      },
    );

    console.log("Correcao de productTypeId finalizada.");
    console.log(`Acessorios atualizados: ${accessoryUpdatedCount}`);
    console.log(`Servicos atualizados: ${serviceUpdatedCount}`);
    console.log(`Roupas sob medida atualizadas: ${customClothingUpdatedCount}`);
  } catch (error) {
    console.error("Erro ao corrigir productTypeId dos produtos importados:", error.message);
    process.exitCode = 1;
  } finally {
    await Products.sequelize.close();
  }
}

fixImportedProductsTypes();
