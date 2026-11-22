const express = require("express");
const controller = require("../controllers/analytics.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const router = express.Router();
router.post("/", requireAuth, controller.run);
module.exports = router;
