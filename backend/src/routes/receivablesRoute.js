const express = require("express");
const controller = require("../controllers/receivablesController");
const authMiddleware = require("../middlewars/authMiddleware.js");

const router = express.Router();

router.use(authMiddleware);

router.get("/", controller.listReceivablesController);
router.post("/", controller.createReceivableController);
router.put("/:installmentId", controller.updateReceivableController);
router.delete("/:installmentId", controller.deleteReceivableController);
router.post("/:installmentId/receipts", controller.registerReceiptController);
router.get("/:installmentId/receipts", controller.listInstallmentReceiptsController);
router.post("/:installmentId/reverse-latest-receipt", controller.reverseLatestReceiptController);

module.exports = router;
