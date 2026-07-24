const { sequelize, Products, PurchasePendings } = require("../models");

function getCurrentMonthRange() {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return {
    startDate,
    endDate,
  };
}

async function getPendingProductionCount() {
  const [rows] = await sequelize.query(
    `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN si."idSaleItem" IS NOT NULL THEN COALESCE(NULLIF(si."quantity", 0), 1)
              ELSE 1
            END
          ),
          0
        )::int AS "total"
      FROM "products" p
      LEFT JOIN "sale_items" si
        ON si."productId" = p."id"
      WHERE
        COALESCE(p."dsbl", false) = false
        AND p."statusId" IN (1, 5);
    `,
  );

  return Number(rows?.[0]?.total || 0);
}

async function listUpcomingFittings(limit = 8) {
  const normalizedLimit = Math.max(1, Math.min(20, Number(limit) || 8));

  const [rows] = await sequelize.query(
    `
      SELECT
        COALESCE(c."fullName", c."companyName", 'Sem cliente') AS "customer",
        DATE(p."testDate") AS "testDate",
        CAST(
          SUM(
            CASE
              WHEN si."idSaleItem" IS NOT NULL THEN COALESCE(NULLIF(si."quantity", 0), 1)
              ELSE 1
            END
          ) AS INTEGER
        ) AS "piecesCount"
      FROM "products" p
      LEFT JOIN "sale_items" si
        ON si."productId" = p."id"
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

async function summarizeMonthlyReceivables() {
  const { startDate, endDate } = getCurrentMonthRange();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [rows] = await sequelize.query(
    `
      SELECT
        COALESCE(SUM(ri."amount"), 0) AS "totalAmount",
        COALESCE(SUM(ri."paidAmount"), 0) AS "totalReceived",
        COALESCE(
          SUM(
            CASE
              WHEN ri."status" IN ('PAID', 'CANCELLED') THEN 0
              ELSE ri."amount" - ri."paidAmount"
            END
          ),
          0
        ) AS "totalOpen",
        COALESCE(
          SUM(
            CASE
              WHEN ri."status" IN ('PAID', 'CANCELLED') THEN 0
              WHEN ri."dueDate" >= :startDate AND ri."dueDate" <= :endDate THEN ri."amount" - ri."paidAmount"
              WHEN ri."dueDate" < :startDate THEN ri."amount" - ri."paidAmount"
              ELSE 0
            END
          ),
          0
        ) AS "totalCardOpen",
        COALESCE(
          SUM(
            CASE
              WHEN ri."status" IN ('PAID', 'CANCELLED') THEN 0
              WHEN ri."dueDate" < :today THEN ri."amount" - ri."paidAmount"
              ELSE 0
            END
          ),
          0
        ) AS "totalOverdue"
      FROM "receivable_installments" ri
      INNER JOIN "receivables" r
        ON r."idReceivable" = ri."receivableId"
      WHERE
        ri."dueDate" >= :startDate
        AND ri."dueDate" <= :endDate
        AND ri."status" != 'CANCELLED'
        AND r."status" != 'CANCELLED';
    `,
    {
      replacements: { startDate, endDate, today },
    },
  );

  return {
    totalAmount: Number(rows?.[0]?.totalAmount || 0),
    totalOpen: Number(rows?.[0]?.totalOpen || 0),
    totalReceived: Number(rows?.[0]?.totalReceived || 0),
    totalCardOpen: Number(rows?.[0]?.totalCardOpen || 0),
    totalOverdue: Number(rows?.[0]?.totalOverdue || 0),
    startDate,
    endDate,
  };
}

async function summarizeMonthlyPayables() {
  const { startDate, endDate } = getCurrentMonthRange();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [rows] = await sequelize.query(
    `
      SELECT
        COALESCE(SUM(p."amount"), 0) AS "totalAmount",
        COALESCE(SUM(p."openAmount"), 0) AS "totalOpen",
        COALESCE(
          SUM(
            CASE
              WHEN p."status" = 'PAID' THEN 0
              WHEN p."dueDate" >= :startDate AND p."dueDate" <= :endDate THEN p."openAmount"
              WHEN p."dueDate" < :startDate THEN p."openAmount"
              ELSE 0
            END
          ),
          0
        ) AS "totalCardOpen",
        COALESCE(
          SUM(
            CASE
              WHEN p."status" = 'PAID' THEN 0
              WHEN p."dueDate" < :today THEN p."openAmount"
              ELSE 0
            END
          ),
          0
        ) AS "totalOverdue"
      FROM "payables" p
      WHERE
        p."status" IN ('OPEN', 'PARTIAL', 'PAID', 'OVERDUE');
    `,
    {
      replacements: { startDate, endDate, today },
    },
  );

  const totalAmount = Number(rows?.[0]?.totalAmount || 0);
  const totalOpen = Number(rows?.[0]?.totalOpen || 0);

  return {
    totalAmount,
    totalOpen,
    totalPaid: Number((totalAmount - totalOpen).toFixed(2)),
    totalCardOpen: Number(rows?.[0]?.totalCardOpen || 0),
    totalOverdue: Number(rows?.[0]?.totalOverdue || 0),
    startDate,
    endDate,
  };
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
  summarizeMonthlyReceivables,
  summarizeMonthlyPayables,
  listPurchasePendings,
  createPurchasePending,
  updatePurchasePending,
  deletePurchasePending,
};
