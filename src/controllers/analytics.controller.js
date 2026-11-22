const repository = require("../repositories/analytics.repository");
const devicesRepository = require("../repositories/devices.repository");
const analytics = require("../services/analytics.service");
const { allGraphIds } = require("../services/analytics.catalog");
const { normalizeMac, isValidMac } = require("../utils/security");

const MAX_PERIOD_DAYS = 365;
const MAX_MEASUREMENTS = 50000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function parseDate(value) {
    if (!DATE_RE.test(value || "")) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(+date) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function run(req, res) {
    try {
        const { inicio, fim } = req.body || {};
        const startDate = parseDate(inicio);
        const endDate = parseDate(fim);
        if (!startDate || !endDate || +startDate > +endDate || (+endDate - +startDate) / 86400000 > MAX_PERIOD_DAYS) {
            return res.status(400).json({ sucesso: false, mensagem: "Informe um período válido de até 366 dias." });
        }
        const timezoneOffsetMinutes = req.body.fuso_minutos == null ? 0 : Number(req.body.fuso_minutos);
        if (!Number.isInteger(timezoneOffsetMinutes) || Math.abs(timezoneOffsetMinutes) > 840) return res.status(400).json({ sucesso: false, mensagem: "Fuso horário inválido." });
        const start = req.body.inicio_em || startDate.toISOString();
        const end = req.body.fim_em || new Date(+endDate + 86400000 - 1).toISOString();
        if (!ISO_RE.test(start) || !ISO_RE.test(end)) {
            return res.status(400).json({ sucesso: false, mensagem: "Informe horários válidos para o período." });
        }
        const startTimestamp = Date.parse(start);
        const endTimestamp = Date.parse(end);
        if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || startTimestamp > endTimestamp) return res.status(400).json({ sucesso: false, mensagem: "Informe horários válidos para o período." });
        const localStart = new Date(startTimestamp - timezoneOffsetMinutes * 60000);
        const localEnd = new Date(endTimestamp - timezoneOffsetMinutes * 60000);
        if (localStart.toISOString().slice(0, 10) !== inicio || localEnd.toISOString().slice(0, 10) !== fim || endTimestamp - startTimestamp > (MAX_PERIOD_DAYS + 1) * 86400000) {
            return res.status(400).json({ sucesso: false, mensagem: "As datas e horas devem permanecer dentro do período informado." });
        }
        const aggregation = req.body.agrupamento || "hour";
        if (!["hour", "day", "month"].includes(aggregation)) return res.status(400).json({ sucesso: false, mensagem: "Agrupamento inválido." });
        const graphIds = Array.isArray(req.body.graficos) ? [...new Set(req.body.graficos)] : [];
        if (graphIds.length > allGraphIds.length || graphIds.some((id) => !allGraphIds.includes(id))) {
            return res.status(400).json({ sucesso: false, mensagem: "A seleção de gráficos contém opções inválidas." });
        }

        const availableDevices = devicesRepository.listByUser(req.user.id);
        const requestedMacs = req.body.esp_ids;
        let selectedDevices = availableDevices;
        if (Array.isArray(requestedMacs)) {
            if (!requestedMacs.length) return res.status(400).json({ sucesso: false, mensagem: "Selecione ao menos um equipamento." });
            const macs = [...new Set(requestedMacs.map(normalizeMac))];
            if (macs.some((mac) => !isValidMac(mac))) return res.status(400).json({ sucesso: false, mensagem: "A seleção contém um MAC inválido." });
            selectedDevices = availableDevices.filter((device) => macs.includes(device.esp_id));
            if (selectedDevices.length !== macs.length) return res.status(404).json({ sucesso: false, mensagem: "Um ou mais equipamentos não pertencem à sua conta ou estão inativos." });
        }

        const rows = repository.measurementsForDevices(req.user.id, selectedDevices.map((device) => device.id), start, end, MAX_MEASUREMENTS + 1);
        const truncated = rows.length > MAX_MEASUREMENTS;
        const boundedRows = truncated ? rows.slice(0, MAX_MEASUREMENTS) : rows;
        const result = analytics.buildAnalytics({ rows: boundedRows, devices: selectedDevices, graphIds, aggregation, start, end, timezoneOffsetMinutes });
        return res.json({ ...result, periodo: { inicio, fim, agrupamento: aggregation }, truncado: truncated });
    } catch (error) {
        console.error("Erro ao gerar análises:", error);
        return res.status(500).json({ sucesso: false, mensagem: "Não foi possível calcular as análises." });
    }
}

module.exports = { run };
