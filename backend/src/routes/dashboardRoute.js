const express = require("express");
const controller = require("../controllers/dashboardController");
const authMiddleware = require("../middlewars/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/summary", controller.getDashboardSummaryController);
router.get("/purchase-pendings", controller.listPurchasePendingsController);
router.post("/purchase-pendings", controller.createPurchasePendingController);
router.put("/purchase-pendings/:id", controller.updatePurchasePendingController);
router.delete("/purchase-pendings/:id", controller.deletePurchasePendingController);

module.exports = router;
