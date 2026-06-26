const express = require("express");
const router = express.Router();

const controller = require("../controllers/clientsController.js");
const authMiddleware = require("../middlewars/authMiddleware.js");

router.use(authMiddleware);

router.get("/", controller.getAllClients);
router.get("/birthdays/month", controller.getBirthdaysOfMonthController);
router.get("/:id", controller.getClientById);
router.post("/", controller.createClient);
router.put("/:id", controller.updateClientById);

module.exports = router;
