const express = require("express");
const controller = require("../controllers/salesController");
const authMiddleware = require("../middlewars/authMiddleware.js");

const router = express.Router();

router.use(authMiddleware);

router.get("/:id", controller.getSaleByIdController);
router.post("/", controller.createSaleController);

module.exports = router;
