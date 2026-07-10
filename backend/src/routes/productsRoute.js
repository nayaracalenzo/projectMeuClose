const express = require("express");
const controller = require("../controllers/productsController");
const authMiddleware = require("../middlewars/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/status-options", controller.listProductStatusesController);
router.get("/:id", controller.getProductByIdController);
router.put("/:id", controller.updateProductByIdController);
router.get("/", controller.listProductsController);

module.exports = router;
