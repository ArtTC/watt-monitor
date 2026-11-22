const { groupByDevice, bucketFor, chart, sortedUnique, round } = require("./analytics.helpers");

function aggregate(rows, key, mode, aggregation, timezoneOffsetMinutes = 0) {
    const grouped = new Map();
    for (const row of rows) {
        const label = bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes);
        if (!grouped.has(label)) grouped.set(label, []);
        grouped.get(label).push(Number(row[key]));
    }
    const result = new Map();
    for (const [label, values] of grouped) {
        result.set(label, mode === "max" ? Math.max(...values) : mode === "min" ? Math.min(...values) : values.reduce((a, b) => a + b, 0) / values.length);
    }
    return result;
}

function rangeChart(rows, metric, id, aggregation, timezoneOffsetMinutes = 0) {
    const groups = new Map();
    for (const row of rows) {
        const label = bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(Number(row[metric]));
    }
    const labels = sortedUnique([...groups.keys()]);
    return chart(id, labels, [
        { name: "Mínima", data: labels.map((label) => Math.min(...groups.get(label))) },
        { name: "Máxima", data: labels.map((label) => Math.max(...groups.get(label))) }
    ], "line", metric === "tensao" ? "V" : "A");
}

function distributionChart(rows, metric, id) {
    const values = rows.map((row) => Number(row[metric])).filter(Number.isFinite);
    const counts = new Map();
    for (const value of values) {
        const rounded = round(value, 2);
        counts.set(rounded, (counts.get(rounded) || 0) + 1);
    }
    const unit = metric === "tensao" ? "V" : "A";
    const sorted = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const labels = sorted.map(([value]) => `${value.toFixed(2)} ${unit}`);
    return chart(id, labels, [{ name: "Médias por intervalo", data: sorted.map(([, count]) => count) }], "hbar", "intervalos");
}

function perDeviceTimeChart(rows, metric, id, unit, aggregation, knownDevices, timezoneOffsetMinutes) {
    const devices = groupByDevice(rows, knownDevices);
    const labels = sortedUnique(rows.map((row) => bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes)));
    const displayLabels = labels.length > 900 ? labels.filter((_, index) => index % Math.ceil(labels.length / 900) === 0) : labels;
    const series = devices.map((device) => {
        const values = aggregate(device.rows, metric, "avg", aggregation, timezoneOffsetMinutes);
        return { name: `${device.name} (${device.mac})`, data: displayLabels.map((label) => values.get(label) ?? null) };
    });
    return chart(id, displayLabels, series, "line", unit);
}

function changeChart(rows, metric, id, unit, aggregation, percent = false, knownDevices = [], timezoneOffsetMinutes = 0) {
    const devices = groupByDevice(rows, knownDevices);
    const points = devices.map((device) => {
        const grouped = new Map();
        for (let index = 1; index < device.rows.length; index++) {
            const previous = Number(device.rows[index - 1][metric]);
            const current = Number(device.rows[index][metric]);
            if (percent && Math.abs(previous) < 1e-6) continue;
            const label = bucketFor(device.rows[index].data_hora, aggregation, timezoneOffsetMinutes);
            if (!grouped.has(label)) grouped.set(label, []);
            grouped.get(label).push(percent ? ((current - previous) / Math.abs(previous)) * 100 : Math.abs(current - previous));
        }
        return { name: `${device.name} (${device.mac})`, values: grouped };
    });
    const labels = sortedUnique(points.flatMap((device) => [...device.values.keys()]));
    return chart(id, labels, points.map((device) => ({
        name: device.name,
        data: labels.map((label) => {
            const values = device.values.get(label);
            return values?.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        })
    })), "line", unit);
}

function generate(rows, id, aggregation, knownDevices = [], timezoneOffsetMinutes = 0) {
    const voltage = id.startsWith("voltage");
    const metric = voltage ? "tensao" : "corrente";
    const unit = voltage ? "V" : "A";
    const interval = { hour: "hora", day: "dia", month: "mês" }[aggregation] || "intervalo";
    if (id === `${voltage ? "voltage" : "current"}-time`) return perDeviceTimeChart(rows, metric, id, unit, aggregation, knownDevices, timezoneOffsetMinutes);
    if (id === `${voltage ? "voltage" : "current"}-daily-average`) {
        const devices = groupByDevice(rows, knownDevices);
        const labels = sortedUnique(rows.map((row) => bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes)));
        const series = devices.map((device) => {
            const means = aggregate(device.rows, metric, "avg", aggregation, timezoneOffsetMinutes);
            return { name: `${device.name} (${device.mac})`, data: labels.map((label) => means.get(label) ?? null) };
        });
        const result = chart(id, labels, series, "line", unit);
        return { ...result, titulo: `${voltage ? "Tensão" : "Corrente"} média por ${interval}`, descricao: `${voltage ? "Tensão" : "Corrente"} média agrupada por ${interval}.` };
    }
    if (id === `${voltage ? "voltage" : "current"}-range`) return rangeChart(rows, metric, id, aggregation, timezoneOffsetMinutes);
    if (id === `${voltage ? "voltage" : "current"}-distribution`) {
        const grouped = aggregate(rows, metric, "avg", aggregation, timezoneOffsetMinutes);
        const intervalRows = [...grouped].map(([label, value]) => ({ data_hora: label, [metric]: value }));
        return distributionChart(intervalRows, metric, id);
    }
    if (id === `${voltage ? "voltage" : "current"}-oscillation`) return changeChart(rows, metric, id, unit, aggregation, false, knownDevices, timezoneOffsetMinutes);
    return null;
}

module.exports = { generate, aggregate };
