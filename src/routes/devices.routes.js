const express = require("express");
const controller = require("../controllers/devices.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();
router.use(requireAuth);
router.get("/", controller.list);
router.get("/removidos", controller.listDeleted);
router.post("/", controller.create);
router.patch("/:esp_id", controller.updateMac);
router.delete("/:esp_id", controller.remove);
router.patch("/:esp_id/reativar", controller.restore);

module.exports = router;
