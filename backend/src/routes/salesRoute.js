const express = require("express");
const controller = require("../controllers/salesController");

const router = express.Router();

router.post("/", controller.createSaleController);

module.exports = router;
