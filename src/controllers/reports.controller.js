const reports = require("../repositories/reports.repository");
const devices = require("../repositories/devices.repository");
const { normalizeMac, isValidMac } = require("../utils/security");

function list(req, res) {
    const { inicio, fim } = req.query;
    const horaInicio = req.query.hora_inicio || "00:00";
    const horaFim = req.query.hora_fim || "23:59";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio || "") || !/^\d{4}-\d{2}-\d{2}$/.test(fim || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaInicio) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaFim) || inicio > fim) {
        return res.status(400).json({ sucesso: false, mensagem: "Informe um período válido com data inicial e final." });
    }
    const start = new Date(`${inicio}T00:00:00.000Z`);
    const end = new Date(`${fim}T00:00:00.000Z`);
    if (Number.isNaN(+start) || Number.isNaN(+end) || start.toISOString().slice(0, 10) !== inicio || end.toISOString().slice(0, 10) !== fim) {
        return res.status(400).json({ sucesso: false, mensagem: "As datas informadas são inválidas." });
    }
    const startTimestamp = req.query.inicio_em || `${inicio}T${horaInicio}:00.000Z`;
    const endTimestamp = req.query.fim_em || `${fim}T${horaFim}:00.000Z`;
    const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    if (!isoTimestamp.test(startTimestamp) || !isoTimestamp.test(endTimestamp)) return res.status(400).json({ sucesso: false, mensagem: "Data e hora inválidas." });
    const startDateTime = new Date(startTimestamp);
    const endDateTime = new Date(endTimestamp);
    if (+startDateTime > +endDateTime) return res.status(400).json({ sucesso: false, mensagem: "A data e hora inicial devem ser anteriores às finais." });
    let deviceIds = null;
    const requestedDevices = req.query.esp_id == null ? [] : Array.isArray(req.query.esp_id) ? req.query.esp_id : [req.query.esp_id];
    if (requestedDevices.length) {
        const macs = [...new Set(requestedDevices.map(normalizeMac))];
        if (macs.some((mac) => !isValidMac(mac))) return res.status(400).json({ sucesso: false, mensagem: "MAC inválido." });
        const ownedDevices = macs.map((mac) => devices.findByMac(mac));
        if (ownedDevices.some((device) => !device || Number(device.usuario_id) !== Number(req.user.id))) return res.status(404).json({ sucesso: false, mensagem: "Um ou mais dispositivos não pertencem à sua conta." });
        deviceIds = ownedDevices.map((device) => device.id);
    }
    try {
        const records = reports.queryForUser(req.user.id, startDateTime.toISOString(), new Date(+endDateTime + 60000).toISOString(), deviceIds);
        const stats = {};
        for (const [key, column] of [["tensao", "tensao"], ["corrente", "corrente"], ["potencia", "potencia"]]) {
            const values = records.map((row) => Number(row[column]));
            stats[key] = values.length ? { media: values.reduce((sum, value) => sum + value, 0) / values.length, minima: Math.min(...values), maxima: Math.max(...values) } : { media: null, minima: null, maxima: null };
        }
        res.json({ periodo: { inicio, fim, hora_inicio: horaInicio, hora_fim: horaFim }, quantidade: records.length, indicadores: stats, medicoes: records });
    } catch (error) { console.error("Erro ao gerar relatório:", error); res.status(500).json({ sucesso: false, mensagem: "Não foi possível gerar o relatório." }); }
}

module.exports = { list };
