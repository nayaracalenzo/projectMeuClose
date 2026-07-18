const express = require("express");
const controller = require("../controllers/bankController");
const transfersController = require("../controllers/transfersController");
const authMiddleware = require("../middlewars/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/account-options", controller.listBankAccountOptionsController);
router.post("/manual-entry", controller.createManualBankEntryController);
router.post("/transfers/to-cash", transfersController.transferBankToCashController);
router.post("/:idBankEntry/reverse", controller.reverseBankEntryController);
router.delete("/:idBankEntry", controller.deleteBankEntryController);
router.get("/", controller.listBankEntriesController);

module.exports = router;
