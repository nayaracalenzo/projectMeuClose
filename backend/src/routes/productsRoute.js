const express = require("express");
const controller = require("../controllers/productsController");
const authMiddleware = require("../middlewars/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", controller.listProductsController);

module.exports = router;
