const { sequelize, Products, Customers, PurchasePendings } = require("../models");

async function getPendingProductionCount() {
  const total = await Products.sum("qtyStock", {
    where: {
      dsbl: false,
      statusId: [1, 5],
    },
  });

  return Number(total || 0);
}

async function listUpcomingFittings(limit = 8) {
  const normalizedLimit = Math.max(1, Math.min(20, Number(limit) || 8));

  const [rows] = await sequelize.query(
    `
      SELECT
        COALESCE(c."fullName", c."companyName", 'Sem cliente') AS "customer",
        DATE(p."testDate") AS "testDate",
        CAST(SUM(COALESCE(p."qtyStock", 1)) AS INTEGER) AS "piecesCount"
      FROM "products" p
      LEFT JOIN "customers" c
        ON c."idCustomer" = p."customerId"
      WHERE
        COALESCE(p."dsbl", false) = false
        AND
        p."testDate" IS NOT NULL
        AND DATE(p."testDate") >= CURRENT_DATE
        AND COALESCE(p."statusId", 0) NOT IN (3, 4)
      GROUP BY
        COALESCE(c."fullName", c."companyName", 'Sem cliente'),
        DATE(p."testDate")
      ORDER BY
        (DATE(p."testDate") - CURRENT_DATE) ASC,
        DATE(p."testDate") ASC,
        COALESCE(c."fullName", c."companyName", 'Sem cliente') ASC
      LIMIT :limit;
    `,
    {
      replacements: { limit: normalizedLimit },
    },
  );

  return rows;
}

async function listPurchasePendings() {
  return PurchasePendings.findAll({
    order: [
      ["done", "ASC"],
      ["createdAt", "DESC"],
    ],
  });
}

async function createPurchasePending(payload) {
  return PurchasePendings.create(payload);
}

async function updatePurchasePending(id, payload) {
  const record = await PurchasePendings.findByPk(id);
  if (!record) return undefined;

  await record.update(payload);
  return record;
}

async function deletePurchasePending(id) {
  const record = await PurchasePendings.findByPk(id);
  if (!record) return undefined;

  await record.destroy();
  return true;
}

module.exports = {
  getPendingProductionCount,
  listUpcomingFittings,
  listPurchasePendings,
  createPurchasePending,
  updatePurchasePending,
  deletePurchasePending,
};
