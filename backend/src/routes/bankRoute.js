const express = require("express");
const controller = require("../controllers/bankController");
const authMiddleware = require("../middlewars/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/account-options", controller.listBankAccountOptionsController);
router.get("/", controller.listBankEntriesController);

module.exports = router;
