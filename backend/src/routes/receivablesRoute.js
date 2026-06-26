const express = require("express");
const controller = require("../controllers/receivablesController");

const router = express.Router();

router.get("/", controller.listReceivablesController);
router.post("/:installmentId/receipts", controller.registerReceiptController);

module.exports = router;
