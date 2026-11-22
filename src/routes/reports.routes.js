const express = require("express");
const controller = require("../controllers/reports.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const router = express.Router();
router.get("/", requireAuth, controller.list);
module.exports = router;
