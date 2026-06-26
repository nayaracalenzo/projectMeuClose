const express = require("express");
const controller = require("../controllers/paymentTypesController");
const authMiddleware = require("../middlewars/authMiddleware.js");

const router = express.Router();

router.use(authMiddleware);

router.get("/", controller.listPaymentTypesController);

module.exports = router;
