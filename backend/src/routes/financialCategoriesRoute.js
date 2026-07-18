const express = require("express");
const controller = require("../controllers/financialCategoriesController");
const authMiddleware = require("../middlewars/authMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.get("/", controller.listFinancialCategoriesController);

module.exports = router;
