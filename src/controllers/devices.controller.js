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

function listDeleted(req, res) {
    try { res.json(devices.listDeletedByUser(req.user.id)); }
    catch (error) { console.error("Erro ao listar dispositivos removidos:", error); res.status(500).json({ sucesso: false, mensagem: "Não foi possível listar os dispositivos removidos." }); }
}

function remove(req, res) {
    try {
        const mac = normalizeMac(req.params.esp_id);
        const device = devices.findByMac(mac);
        if (!device || Number(device.usuario_id) !== Number(req.user.id)) return res.status(404).json({ sucesso: false, mensagem: "Dispositivo não encontrado na sua conta." });
        if (device.removido_em) return res.status(409).json({ sucesso: false, mensagem: "Este dispositivo já foi removido." });
        devices.remove(mac, req.user.id, new Date().toISOString());
        return res.json({ sucesso: true, mensagem: "Dispositivo removido. O histórico foi preservado." });
    } catch (error) { console.error("Erro ao remover dispositivo:", error); res.status(500).json({ sucesso: false, mensagem: "Não foi possível remover o dispositivo." }); }
}

function restore(req, res) {
    try {
        const mac = normalizeMac(req.params.esp_id);
        const device = devices.findByMac(mac);
        if (!device || Number(device.usuario_id) !== Number(req.user.id)) return res.status(404).json({ sucesso: false, mensagem: "Dispositivo não encontrado na sua conta." });
        const result = devices.restore(mac, req.user.id);
        if (!Number(result.changes)) return res.status(409).json({ sucesso: false, mensagem: "Este dispositivo já está ativo." });
        return res.json({ sucesso: true, mensagem: "Dispositivo reativado." });
    } catch (error) { console.error("Erro ao reativar dispositivo:", error); res.status(500).json({ sucesso: false, mensagem: "Não foi possível reativar o dispositivo." }); }
}

function updateMac(req, res) {
    try {
        const oldMac = normalizeMac(req.params.esp_id);
        const newMac = normalizeMac(req.body.esp_id);
        if (!isValidMac(newMac)) return res.status(400).json({ sucesso: false, mensagem: "Informe o novo MAC no formato AA:BB:CC:DD:EE:FF." });
        const device = devices.findByMac(oldMac);
        if (!device || Number(device.usuario_id) !== Number(req.user.id) || device.esp_id !== oldMac || device.removido_em) {
            return res.status(404).json({ sucesso: false, mensagem: "Dispositivo ativo não encontrado na sua conta." });
        }
        const conflict = devices.findByMac(newMac);
        if (conflict && Number(conflict.id) !== Number(device.id)) {
            return res.status(409).json({ sucesso: false, mensagem: "Este MAC já está associado a outro equipamento." });
        }
        if (newMac !== oldMac) devices.updateMac({ deviceId: device.id, oldMac, newMac, changedAt: new Date().toISOString() });
        return res.json({ sucesso: true, mensagem: "MAC atualizado. O histórico anterior foi preservado.", dispositivo: { esp_id: newMac, nome: device.nome } });
    } catch (error) {
        console.error("Erro ao atualizar MAC do dispositivo:", error);
        if (String(error.code || "").startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ sucesso: false, mensagem: "Este MAC já está associado a outro equipamento." });
        return res.status(500).json({ sucesso: false, mensagem: "Não foi possível atualizar o MAC do dispositivo." });
    }
}

module.exports = { list, create, listDeleted, remove, restore, updateMac };
