const express = require("express");
const controller = require("../controllers/payablesController");

const router = express.Router();

router.get("/", controller.listPayablesController);
router.post("/", controller.createPayableController);
router.post("/:payableId/payments", controller.registerPayablePaymentController);

module.exports = router;
