const energy = require("./energy.service");
const { groupByDevice, bucketFor, chart, round, sortedUnique } = require("./analytics.helpers");

function generate(rows, id, aggregation = "day", knownDevices = [], timezoneOffsetMinutes = 0) {
    const devices = groupByDevice(rows, knownDevices);
    const interval = { hour: "hora", day: "dia", month: "mês" }[aggregation] || "intervalo";
    const labels = sortedUnique(rows.map((row) => bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes)));

    if (id === "compare-energy") {
        const grouped = energy.energyByDevice(rows, aggregation, knownDevices, timezoneOffsetMinutes);
        const series = grouped.map((device) => ({ name: `${device.name} (${device.mac})`, data: labels.map((label) => device.energy.get(label) || 0) }));
        return { ...chart(id, labels, series, "bar", "Wh"), titulo: `Energia por equipamento por ${interval}`, descricao: `Energia integrada em cada intervalo para cada equipamento.` };
    }

    const metricById = { "compare-power-avg": "potencia", "compare-power-max": "potencia", "compare-voltage": "tensao", "compare-current": "corrente" };
    if (metricById[id]) {
        const metric = metricById[id];
        const series = devices.map((device) => {
            const buckets = new Map();
            for (const row of device.rows) {
                const label = bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes);
                if (!buckets.has(label)) buckets.set(label, []);
                buckets.get(label).push(Number(row[metric]));
            }
            return { name: `${device.name} (${device.mac})`, data: labels.map((label) => {
                const values = buckets.get(label);
                if (!values?.length) return null;
                return id === "compare-power-max" ? Math.max(...values) : values.reduce((sum, value) => sum + value, 0) / values.length;
            }) };
        });
        const unit = metric === "potencia" ? "W" : metric === "tensao" ? "V" : "A";
        const statistic = id === "compare-power-max" ? "máxima" : "média";
        const metricLabel = unit === "W" ? `Potência ${statistic}` : unit === "V" ? "Tensão média" : "Corrente média";
        return { ...chart(id, labels, series, "line", unit), titulo: `${metricLabel} por equipamento por ${interval}`, descricao: `${metricLabel} por equipamento em cada intervalo de ${interval}.` };
    }

    if (id === "compare-hour-profile") {
        const series = devices.map((device) => {
            const buckets = new Map();
            for (const row of device.rows) {
                const label = bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes);
                if (!buckets.has(label)) buckets.set(label, []);
                buckets.get(label).push(Number(row.potencia));
            }
            return { name: `${device.name} (${device.mac})`, data: labels.map((label) => {
                const values = buckets.get(label) || [];
                return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
            }) };
        });
        return { ...chart(id, labels, series, "line", "W"), titulo: `Perfil de potência por equipamento por ${interval}`, descricao: `Potência média em cada intervalo de ${interval} para cada equipamento.` };
    }
    return null;
}

module.exports = { generate };
