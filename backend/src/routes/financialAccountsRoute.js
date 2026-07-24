const express = require("express");
const controller = require("../controllers/financialAccountsController");
const authMiddleware = require("../middlewars/authMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.get("/options", controller.listFinancialAccountOptionsController);

module.exports = router;
