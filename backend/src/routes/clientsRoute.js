const express = require("express");
const router = express.Router();

const controller = require("../controllers/clientsController.js");

// const authMiddleware = require("../middlewars/authMiddleware.js");

router.get("/", controller.getAllClients);
router.get("/birthdays/month", controller.getBirthdaysOfMonthController);

module.exports = router;