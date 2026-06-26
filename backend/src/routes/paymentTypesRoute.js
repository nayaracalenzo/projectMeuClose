const express = require("express");
const controller = require("../controllers/paymentTypesController");

const router = express.Router();

router.get("/", controller.listPaymentTypesController);

module.exports = router;
