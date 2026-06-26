const express = require("express");
const controller = require("../controllers/receivablesController");
const authMiddleware = require("../middlewars/authMiddleware.js");

const router = express.Router();

router.use(authMiddleware);

router.get("/", controller.listReceivablesController);
router.post("/:installmentId/receipts", controller.registerReceiptController);

module.exports = router;
