const express = require("express");
const controller = require("../controllers/measurements.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();
// O ESP32 envia medições sem chave, identificado pelo MAC previamente cadastrado.
router.post("/medicao", controller.receive);

// Todas as consultas do painel exigem login e respeitam o usuário autenticado.
router.get("/medicao", requireAuth, controller.latestForUser);
router.get("/medicoes", requireAuth, controller.historyForUser);
router.get("/medicoes/:esp_id", requireAuth, controller.historyForDevice);

module.exports = router;
