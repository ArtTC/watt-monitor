const devices = require("../repositories/devices.repository");
const { normalizeMac, isValidMac } = require("../utils/security");

function list(req, res) {
    try {
        res.json(devices.listByUser(req.user.id));
    } catch (error) {
        console.error("Erro ao listar dispositivos:", error);
        res.status(500).json({ sucesso: false, mensagem: "Não foi possível listar os dispositivos." });
    }
}

function create(req, res) {
    try {
        const mac = normalizeMac(req.body.esp_id);
        const name = String(req.body.nome || "").trim();

        if (!isValidMac(mac)) {
            return res.status(400).json({ sucesso: false, mensagem: "Informe o MAC no formato AA:BB:CC:DD:EE:FF." });
        }
        if (name.length < 2 || name.length > 60) {
            return res.status(400).json({ sucesso: false, mensagem: "Informe um nome entre 2 e 60 caracteres." });
        }

        const existing = devices.findByMac(mac);
        if (existing) {
            return res.status(409).json({
                sucesso: false,
                mensagem: Number(existing.usuario_id) === Number(req.user.id)
                    ? "Este ESP32 já está vinculado à sua conta."
                    : "Este ESP32 já está vinculado a outra conta."
            });
        }

        devices.create({
            mac,
            userId: req.user.id,
            name,
            createdAt: new Date().toISOString()
        });

        res.status(201).json({
            sucesso: true,
            mensagem: "Dispositivo vinculado à sua conta pelo endereço MAC.",
            dispositivo: { esp_id: mac, nome: name }
        });
    } catch (error) {
        console.error("Erro ao cadastrar dispositivo:", error);
        res.status(500).json({ sucesso: false, mensagem: "Não foi possível cadastrar o dispositivo." });
    }
}

module.exports = { list, create };
