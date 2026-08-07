const { sequelize, Status } = require("../models");
const { logger, serializeError } = require("../utils/logger");

const OVERDUE_STATUS_ID = 5;
const OVERDUE_STATUS_DESC = "ATRASADA";
const TARGET_HOUR = 8;

async function syncOverdueProductsStatus() {
  try {
    await Status.upsert({
      id: OVERDUE_STATUS_ID,
      desc: OVERDUE_STATUS_DESC,
    });

    const [result] = await sequelize.query(`
      UPDATE "products"
      SET "statusId" = ${OVERDUE_STATUS_ID},
          "updatedAt" = NOW()
      WHERE "statusId" = 1
        AND "testDate" IS NOT NULL
        AND DATE("testDate") < CURRENT_DATE;
    `);

    const updatedCount = Number(result?.rowCount || 0);

    logger.info("Overdue products status sync completed", {
      operation: "syncOverdueProductsStatus",
      updatedCount,
    });

    return updatedCount;
  } catch (error) {
    logger.error("Overdue products status sync failed", {
      operation: "syncOverdueProductsStatus",
      ...serializeError(error),
    });
    throw error;
  }
}

function getMsUntilNextRun(now = new Date()) {
  const nextRun = new Date(now);
  nextRun.setHours(TARGET_HOUR, 0, 0, 0);

  if (now.getTime() >= nextRun.getTime()) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun.getTime() - now.getTime();
}

function scheduleOverdueProductsStatusSync() {
  const delay = getMsUntilNextRun();

  logger.info("Scheduled overdue products status sync", {
    operation: "scheduleOverdueProductsStatusSync",
    nextRunInMs: delay,
    targetHour: TARGET_HOUR,
  });

  setTimeout(async () => {
    await syncOverdueProductsStatus().catch(() => {});
    scheduleOverdueProductsStatusSync();
  }, delay);
}

module.exports = {
  syncOverdueProductsStatus,
  scheduleOverdueProductsStatusSync,
};
