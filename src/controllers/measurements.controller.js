const devices = require("../repositories/devices.repository");
const measurements = require("../repositories/measurements.repository");
const { normalizeMac, isValidMac } = require("../utils/security");

function receive(req, res) {
    try {
        const mac = normalizeMac(req.body.esp_id);
        const { tensao, corrente, potencia } = req.body;

        if (!isValidMac(mac)) {
            return res.status(400).json({ sucesso: false, mensagem: "Identificação MAC inválida." });
        }
        if (
            typeof tensao !== "number" || !Number.isFinite(tensao) ||
            typeof corrente !== "number" || !Number.isFinite(corrente) ||
            typeof potencia !== "number" || !Number.isFinite(potencia)
        ) {
            return res.status(400).json({ sucesso: false, mensagem: "Valores de medição inválidos." });
        }

        // Sem chave adicional: o MAC precisa estar previamente vinculado a uma conta.
        const device = devices.findByMac(mac);
        if (!device || device.removido_em || Number(device.aceita_medicoes) !== 1 || device.esp_id !== mac) {
            return res.status(403).json({ sucesso: false, mensagem: "ESP32 não cadastrado. Vincule o dispositivo a uma conta primeiro." });
        }

        const measuredAt = new Date().toISOString();
        const result = measurements.create({ mac, measuredAt, voltage: tensao, current: corrente, power: potencia });

        console.log(`[MEDIÇÃO] ${device.nome} (${mac}) | ${tensao} V | ${corrente} A | ${potencia} W`);
        res.status(200).json({
            sucesso: true,
            mensagem: "Medição recebida e armazenada!",
            esp_id: mac,
            id: Number(result.lastInsertRowid)
        });
    } catch (error) {
        console.error("Erro ao receber medição:", error);
        res.status(500).json({ sucesso: false, mensagem: "Erro interno ao armazenar medição." });
    }
}

function latestForUser(req, res) {
    try {
        res.json(measurements.latestForUser(req.user.id) || {
            mensagem: "Nenhuma medição recebida para seus dispositivos."
        });
    } catch (error) {
        console.error("Erro ao consultar última medição:", error);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao consultar banco de dados." });
    }
}

function historyForUser(req, res) {
    try {
        res.json(measurements.historyForUser(req.user.id));
    } catch (error) {
        console.error("Erro ao consultar histórico:", error);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao consultar histórico." });
    }
}

function historyForDevice(req, res) {
    try {
        const mac = normalizeMac(req.params.esp_id);
        const device = devices.findByMac(mac);
        if (!device || Number(device.usuario_id) !== Number(req.user.id)) {
            return res.status(404).json({ mensagem: "Dispositivo não encontrado na sua conta." });
        }
        res.json(measurements.historyForDevice(device.id, req.user.id));
    } catch (error) {
        console.error("Erro ao consultar medições do dispositivo:", error);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao consultar medições do dispositivo." });
    }
}

module.exports = { receive, latestForUser, historyForUser, historyForDevice };
