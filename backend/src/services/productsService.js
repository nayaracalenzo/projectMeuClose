const repository = require("../repositories/productsRepository");

function mapProductRow(product) {
  const customer = product.Customer || product.Customers;
  const employee = product.Employee || product.Employees;
  const status = product.Status;
  const productType = product.ProductsType || product.ProductsTypes;
  const clothingType = product.ClothingsType;

  return {
    id: product.id,
    saleId: product.saleId,
    description: product.desc,
    customer: customer?.fullName || customer?.companyName || "Sem cliente",
    productType: productType?.desc || null,
    clothingType: clothingType?.desc || null,
    seamstress: employee?.shortName || null,
    status: status?.desc || null,
    finalValue: Number(product.finalValue || 0),
    testDate: product.testDate,
    createdAt: product.createdAt,
  };
}

async function listProducts(filters = {}) {
  const products = await repository.listProducts(filters);
  return products.map(mapProductRow);
}

module.exports = {
  listProducts,
};
