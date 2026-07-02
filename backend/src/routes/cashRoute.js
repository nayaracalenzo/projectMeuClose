const express = require("express");
const controller = require("../controllers/cashController");
const cashSessionController = require("../controllers/cashSessionController");
const authMiddleware = require("../middlewars/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/session-status", cashSessionController.getStoreSessionStatusController);
router.post("/sessions/open", cashSessionController.openStoreSessionController);
router.post(
  "/sessions/current/close",
  cashSessionController.closeCurrentStoreSessionController,
);
router.get("/", controller.listCashEntriesController);

module.exports = router;
