const express = require("express");
const controller = require("../controllers/devices.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();
router.use(requireAuth);
router.get("/", controller.list);
router.post("/", controller.create);

module.exports = router;
