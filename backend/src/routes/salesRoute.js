const express = require("express");
const controller = require("../controllers/salesController");
const authMiddleware = require("../middlewars/authMiddleware.js");

const router = express.Router();

router.use(authMiddleware);

router.get("/", controller.listSalesController);
router.get("/:id", controller.getSaleByIdController);
router.post("/:id/cancel", controller.cancelSaleController);
router.put("/:id/finalize", controller.finalizeSaleController);
router.post("/", controller.createSaleController);

module.exports = router;
