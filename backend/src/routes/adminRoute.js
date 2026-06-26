const express = require("express");
const controller = require("../controllers/adminController");

const router = express.Router();

router.get("/:resource", controller.listResourceController);
router.post("/:resource", controller.createResourceController);
router.put("/:resource/:id", controller.updateResourceController);
router.delete("/:resource/:id", controller.deleteResourceController);

module.exports = router;
