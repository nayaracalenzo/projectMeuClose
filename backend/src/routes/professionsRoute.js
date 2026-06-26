const express = require("express");
const router = express.Router();
const controller = require("../controllers/professionsController");
const authMiddleware = require("../middlewars/authMiddleware.js");

router.use(authMiddleware);

router.get("/", controller.getAllProfessions);

module.exports = router;
