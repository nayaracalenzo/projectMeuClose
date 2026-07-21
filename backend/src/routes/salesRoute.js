const express = require("express");
const controller = require("../controllers/salesController");
const authMiddleware = require("../middlewars/authMiddleware.js");

const router = express.Router();

router.use(authMiddleware);

router.get("/", controller.listSalesController);
router.get("/:id", controller.getSaleByIdController);
router.put("/:id", controller.updateSaleController);
router.delete("/:id", controller.deleteSaleController);
router.post("/:id/items/:itemId/cancel", controller.cancelSaleItemController);
router.post("/:id/cancel", controller.cancelSaleController);
router.post("/:id/renegotiate-payment", controller.renegotiateSalePaymentController);
router.put("/:id/finalize", controller.finalizeSaleController);
router.post("/", controller.createSaleController);

module.exports = router;
