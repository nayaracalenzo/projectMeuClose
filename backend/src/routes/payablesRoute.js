const express = require("express");
const controller = require("../controllers/payablesController");
const authMiddleware = require("../middlewars/authMiddleware.js");

const router = express.Router();

router.use(authMiddleware);

router.get("/", controller.listPayablesController);
router.post("/", controller.createPayableController);
router.post("/:payableId/payments", controller.registerPayablePaymentController);

module.exports = router;
