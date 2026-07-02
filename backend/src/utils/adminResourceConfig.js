const resourceConfig = {
  employees: {
    modelName: "Employees",
    primaryKey: "idEmployee",
    softDelete: true,
    defaultOrder: [["fullName", "ASC"]],
    editableFields: [
      "fullName",
      "shortName",
      "document",
      "rg",
      "zipCode",
      "street",
      "number",
      "complement",
      "neighborhood",
      "city",
      "state",
      "primaryPhone",
      "secondaryPhone",
      "nameSecPhone",
      "email",
      "comment",
      "birthDate",
      "roleId",
      "bankData",
      "active",
    ],
  },
  roles: {
    modelName: "Roles",
    primaryKey: "id",
    defaultOrder: [["desc", "ASC"]],
    editableFields: ["desc"],
  },
  colors: {
    modelName: "Colors",
    primaryKey: "id",
    defaultOrder: [["desc", "ASC"]],
    editableFields: ["desc"],
  },
  categories: {
    modelName: "Categories",
    primaryKey: "id",
    defaultOrder: [["id", "ASC"]],
    editableFields: ["desc"],
  },
  sizes: {
    modelName: "Sizes",
    primaryKey: "id",
    defaultOrder: [["desc", "ASC"]],
    editableFields: ["desc"],
  },
  "clothings-types": {
    modelName: "ClothingsType",
    primaryKey: "id",
    defaultOrder: [["desc", "ASC"]],
    editableFields: ["desc"],
  },
  "products-types": {
    modelName: "ProductsTypes",
    primaryKey: "id",
    defaultOrder: [["desc", "ASC"]],
    editableFields: ["desc"],
  },
  fabrics: {
    modelName: "Fabrics",
    primaryKey: "id",
    defaultOrder: [["desc", "ASC"]],
    editableFields: ["desc"],
  },
  "payment-types": {
    modelName: "PaymentTypes",
    primaryKey: "idPaymentType",
    defaultOrder: [["idPaymentType", "ASC"]],
    editableFields: ["desc"],
  },
};

function getAdminResourceConfig(resource) {
  return resourceConfig[resource] || null;
}

module.exports = {
  getAdminResourceConfig,
};
