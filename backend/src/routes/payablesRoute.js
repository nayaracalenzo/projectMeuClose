const express = require("express");
const controller = require("../controllers/payablesController");
const authMiddleware = require("../middlewars/authMiddleware.js");

const router = express.Router();

router.use(authMiddleware);

router.get("/", controller.listPayablesController);
router.post("/", controller.createPayableController);
router.put("/:payableId", controller.updatePayableController);
router.delete("/:payableId", controller.deletePayableController);
router.post("/:payableId/payments", controller.registerPayablePaymentController);

module.exports = router;
