const energyService = require("./energy.service");
const electricalService = require("./electrical.service");
const powerService = require("./power.service");
const comparisonService = require("./comparison.service");
const anomalyService = require("./anomaly.service");
const availabilityService = require("./availability.service");
const { groupByDevice, round } = require("./analytics.helpers");
const { graphMeta } = require("./analytics.catalog");

function buildIndicators(rows, devices, timezoneOffsetMinutes = 0) {
    const count = rows.length;
    const mean = (key) => count ? rows.reduce((sum, row) => sum + Number(row[key]), 0) / count : 0;
    const maxima = (key) => count ? Math.max(...rows.map((row) => Number(row[key]))) : 0;
    return {
        energia_wh: round(energyService.totalEnergyWh(rows, devices, timezoneOffsetMinutes)),
        potencia_media: round(mean("potencia")),
        potencia_maxima: round(maxima("potencia")),
        tensao_media: round(mean("tensao")),
        corrente_media: round(mean("corrente"), 4),
        quantidade_medicoes: count,
        quantidade_equipamentos: devices.length,
        por_equipamento: groupByDevice(rows, devices).map((device) => ({
            id: device.id, nome: device.name, mac: device.mac, quantidade: device.rows.length,
            potencia_media: device.rows.length ? round(device.rows.reduce((sum, row) => sum + Number(row.potencia), 0) / device.rows.length) : 0,
            potencia_maxima: device.rows.length ? round(Math.max(...device.rows.map((row) => Number(row.potencia)))) : 0
        }))
    };
}

function buildAnalytics({ rows, devices, graphIds, aggregation, start, end, timezoneOffsetMinutes = 0 }) {
    const graphs = {};
    for (const id of graphIds) {
        const meta = graphMeta[id];
        let result;
        if (id.startsWith("energy-")) result = energyService.generate(rows, id, aggregation, devices, timezoneOffsetMinutes);
        else if (id.startsWith("power-")) result = powerService.generate(rows, id, aggregation, devices, timezoneOffsetMinutes);
        else if (id.startsWith("voltage-") || id.startsWith("current-")) result = electricalService.generate(rows, id, aggregation, devices, timezoneOffsetMinutes);
        else if (id.startsWith("compare-")) result = comparisonService.generate(rows, id, aggregation, devices, timezoneOffsetMinutes);
        else if (id.startsWith("anomaly-")) result = anomalyService.generate(rows, id, devices, timezoneOffsetMinutes);
        else if (id.startsWith("availability-")) result = availabilityService.generate(rows, id, start, end, aggregation, devices, timezoneOffsetMinutes);
        if (result) graphs[id] = { ...metaObject(id, meta), ...result };
    }
    return { indicadores: buildIndicators(rows, devices, timezoneOffsetMinutes), graficos: graphs };
}

function metaObject(id, meta) {
    return { id, titulo: meta[0], descricao: meta[1], unidade: meta[2], tipo: meta[3] };
}

module.exports = { buildAnalytics, buildIndicators };
