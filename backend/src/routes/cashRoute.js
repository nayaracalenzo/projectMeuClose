const express = require("express");
const controller = require("../controllers/cashController");
const cashSessionController = require("../controllers/cashSessionController");
const transfersController = require("../controllers/transfersController");
const authMiddleware = require("../middlewars/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/session-status", cashSessionController.getStoreSessionStatusController);
router.post("/sessions/open", cashSessionController.openStoreSessionController);
router.post(
  "/sessions/current/close",
  cashSessionController.closeCurrentStoreSessionController,
);
router.post("/transfers/to-bank", transfersController.transferStoreCashToBankController);
router.post("/manual-entry", controller.createManualCashEntryController);
router.post("/:idCashEntry/reverse", controller.reverseCashEntryController);
router.get("/", controller.listCashEntriesController);

module.exports = router;
