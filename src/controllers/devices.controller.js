const devices = require("../repositories/devices.repository");
const { normalizeMac, isValidMac } = require("../utils/security");

function list(req, res) {
    try {
        res.json(devices.listByUser(req.user.id));
    } catch (error) {
        console.error("Erro ao listar equipamentos:", error);
        res.status(500).json({ sucesso: false, mensagem: "Não foi possível listar os equipamentos." });
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
            mensagem: "Equipamento vinculado à sua conta pelo endereço MAC.",
            dispositivo: { esp_id: mac, nome: name }
        });
    } catch (error) {
        console.error("Erro ao cadastrar equipamento:", error);
        res.status(500).json({ sucesso: false, mensagem: "Não foi possível cadastrar o equipamento." });
    }
}

function listDeleted(req, res) {
    try { res.json(devices.listDeletedByUser(req.user.id)); }
    catch (error) { console.error("Erro ao listar equipamentos removidos:", error); res.status(500).json({ sucesso: false, mensagem: "Não foi possível listar os equipamentos removidos." }); }
}

function remove(req, res) {
    try {
        const mac = normalizeMac(req.params.esp_id);
        const device = devices.findByMac(mac);
        if (!device || Number(device.usuario_id) !== Number(req.user.id)) return res.status(404).json({ sucesso: false, mensagem: "Equipamento não encontrado na sua conta." });
        if (device.removido_em) return res.status(409).json({ sucesso: false, mensagem: "Este equipamento já foi removido." });
        devices.remove(mac, req.user.id, new Date().toISOString());
        return res.json({ sucesso: true, mensagem: "Equipamento removido. O histórico foi preservado." });
    } catch (error) { console.error("Erro ao remover equipamento:", error); res.status(500).json({ sucesso: false, mensagem: "Não foi possível remover o equipamento." }); }
}

function restore(req, res) {
    try {
        const mac = normalizeMac(req.params.esp_id);
        const device = devices.findByMac(mac);
        if (!device || Number(device.usuario_id) !== Number(req.user.id)) return res.status(404).json({ sucesso: false, mensagem: "Equipamento não encontrado na sua conta." });
        const result = devices.restore(mac, req.user.id);
        if (!Number(result.changes)) return res.status(409).json({ sucesso: false, mensagem: "Este equipamento já está ativo." });
        return res.json({ sucesso: true, mensagem: "Equipamento reativado." });
    } catch (error) { console.error("Erro ao reativar equipamento:", error); res.status(500).json({ sucesso: false, mensagem: "Não foi possível reativar o equipamento." }); }
}

function updateMac(req, res) {
    try {
        const oldMac = normalizeMac(req.params.esp_id);
        const newMac = normalizeMac(req.body.esp_id);
        if (req.body.esp_id !== undefined && !isValidMac(newMac)) return res.status(400).json({ sucesso: false, mensagem: "Informe o novo MAC no formato AA:BB:CC:DD:EE:FF." });
        const device = devices.findByMac(oldMac);
        if (!device || Number(device.usuario_id) !== Number(req.user.id) || device.esp_id !== oldMac || device.removido_em) {
            return res.status(404).json({ sucesso: false, mensagem: "Equipamento ativo não encontrado na sua conta." });
        }
        const name = req.body.nome === undefined ? device.nome : String(req.body.nome).trim();
        if (name.length < 2 || name.length > 60) return res.status(400).json({ sucesso: false, mensagem: "Informe um nome entre 2 e 60 caracteres." });
        const targetMac = req.body.esp_id === undefined ? oldMac : newMac;
        const conflict = devices.findByMac(targetMac);
        if (conflict && Number(conflict.id) !== Number(device.id)) {
            return res.status(409).json({ sucesso: false, mensagem: "Este MAC já está associado a outro equipamento." });
        }
        if (targetMac !== oldMac || name !== device.nome) devices.updateMac({ deviceId: device.id, oldMac, newMac: targetMac, name, changedAt: new Date().toISOString() });
        return res.json({ sucesso: true, mensagem: "Equipamento atualizado. O histórico anterior foi preservado.", dispositivo: { esp_id: targetMac, nome: name } });
    } catch (error) {
        console.error("Erro ao atualizar MAC do equipamento:", error);
        if (String(error.code || "").startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ sucesso: false, mensagem: "Este MAC já está associado a outro equipamento." });
        return res.status(500).json({ sucesso: false, mensagem: "Não foi possível atualizar o MAC do equipamento." });
    }
}

module.exports = { list, create, listDeleted, remove, restore, updateMac };
