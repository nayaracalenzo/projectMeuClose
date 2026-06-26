const express = require("express");
const controller = require("../controllers/adminController");
const authMiddleware = require("../middlewars/authMiddleware.js");

const router = express.Router();

router.use(authMiddleware);

router.get("/:resource", controller.listResourceController);
router.post("/:resource", controller.createResourceController);
router.put("/:resource/:id", controller.updateResourceController);
router.delete("/:resource/:id", controller.deleteResourceController);

module.exports = router;
